"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { uploadUrl } from "@/features/browser/api/client";
import {
  UPLOAD_CONCURRENCY,
  UPLOAD_MAX_ATTEMPTS,
} from "@/features/browser/lib/limits";

export type UploadStatus = "queued" | "uploading" | "done" | "error";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  /** 0..1 — bytes sent so far over total. */
  progress: number;
  status: UploadStatus;
  error?: string;
}

/** A bare File uploads under its own name; the pair form carries a
 * folder-relative path ("photos/a.jpg") from a dropped directory. */
export type UploadInput = File | { file: File; path: string };

interface PendingFile {
  file: File;
  path: string;
  attempts: number;
}

/** Network errors and server-side failures are worth retrying; a 4xx verdict
 * (too large, no permission, bad name) won't change on a second attempt. */
function isTransient(status: number) {
  return status === 0 || status === 429 || status >= 500;
}

/**
 * Client-side upload queue. Files wait in a FIFO queue and at most
 * `UPLOAD_CONCURRENCY` XMLHttpRequests run at once — the one browser API with
 * upload progress events — so dropping a large folder can't open thousands of
 * concurrent requests. Transient failures (network, 5xx) re-queue up to
 * `UPLOAD_MAX_ATTEMPTS`; failed rows expose a manual retry. `onQueueSettled`
 * fires once every queued upload has finished (done, failed or canceled),
 * which is the moment to refresh the listing.
 */
export function useUploads(
  sourceId: string,
  prefix: string,
  onQueueSettled: () => void,
) {
  const t = useTranslations("browser.uploadTray");
  const [items, setItems] = useState<UploadItem[]>([]);
  const requests = useRef(new Map<string, XMLHttpRequest>());
  const pending = useRef(new Map<string, PendingFile>());
  const queue = useRef<string[]>([]);
  const active = useRef(0);

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }, []);

  const startNext = useCallback(() => {
    while (active.current < UPLOAD_CONCURRENCY) {
      const id = queue.current.shift();
      if (id === undefined) break;
      const entry = pending.current.get(id);
      if (!entry) continue; // canceled while queued

      active.current += 1;
      entry.attempts += 1;
      patch(id, { status: "uploading", progress: 0, error: undefined });

      const xhr = new XMLHttpRequest();
      requests.current.set(id, xhr);

      const settle = () => {
        requests.current.delete(id);
        active.current -= 1;
        startNext();
        if (active.current === 0 && queue.current.length === 0) {
          onQueueSettled();
        }
      };
      const fail = (message: string) => {
        if (entry.attempts < UPLOAD_MAX_ATTEMPTS) {
          patch(id, { status: "queued", progress: 0 });
          queue.current.push(id);
        } else {
          // Keep the pending entry: the tray's manual retry needs the File.
          patch(id, { status: "error", error: message });
        }
        settle();
      };

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          patch(id, { progress: event.loaded / event.total });
        }
      };
      xhr.onload = () => {
        if (xhr.status === 201) {
          pending.current.delete(id);
          patch(id, { status: "done", progress: 1 });
          settle();
        } else if (isTransient(xhr.status)) {
          fail(xhr.responseText || t("uploadFailed", { status: xhr.status }));
        } else {
          // Definitive verdict — retrying an oversized or forbidden upload
          // would only fail again, so don't burn the remaining attempts.
          entry.attempts = UPLOAD_MAX_ATTEMPTS;
          fail(xhr.responseText || t("uploadFailed", { status: xhr.status }));
        }
      };
      xhr.onerror = () => {
        fail(t("networkError"));
      };
      xhr.onabort = () => {
        pending.current.delete(id);
        setItems((prev) => prev.filter((item) => item.id !== id));
        settle();
      };

      xhr.open("POST", uploadUrl(sourceId, prefix + entry.path));
      xhr.send(entry.file);
    }
  }, [sourceId, prefix, onQueueSettled, patch, t]);

  const addFiles = useCallback(
    (inputs: Iterable<UploadInput>) => {
      const added: UploadItem[] = [];
      for (const input of inputs) {
        const { file, path } =
          input instanceof File ? { file: input, path: input.name } : input;
        const id = crypto.randomUUID();
        pending.current.set(id, { file, path, attempts: 0 });
        queue.current.push(id);
        added.push({
          id,
          name: path,
          size: file.size,
          progress: 0,
          status: "queued",
        });
      }
      if (added.length === 0) return;
      setItems((prev) => [...prev, ...added]);
      startNext();
    },
    [startNext],
  );

  const cancel = useCallback((id: string) => {
    const xhr = requests.current.get(id);
    if (xhr) {
      xhr.abort(); // onabort settles and removes the row
      return;
    }
    // Still waiting in the queue — drop it before it ever starts.
    pending.current.delete(id);
    queue.current = queue.current.filter((queued) => queued !== id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /** Re-queues a failed upload with a fresh attempt budget. */
  const retry = useCallback(
    (id: string) => {
      const entry = pending.current.get(id);
      if (!entry) return;
      entry.attempts = 0;
      queue.current.push(id);
      patch(id, { status: "queued", progress: 0, error: undefined });
      startNext();
    },
    [patch, startNext],
  );

  /** Clears finished rows; anything queued or uploading stays. */
  const dismiss = useCallback(() => {
    setItems((prev) => {
      const kept = prev.filter(
        (item) => item.status === "uploading" || item.status === "queued",
      );
      // Dismissed error rows can no longer be retried — release their Files.
      const keptIds = new Set(kept.map((item) => item.id));
      for (const id of pending.current.keys()) {
        if (!keptIds.has(id)) pending.current.delete(id);
      }
      return kept;
    });
  }, []);

  return { items, addFiles, cancel, retry, dismiss };
}
