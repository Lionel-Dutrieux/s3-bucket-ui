"use client";

import { useCallback, useRef, useState } from "react";
import { uploadUrl } from "@/features/browser/api/client";

export type UploadStatus = "uploading" | "done" | "error";

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

/**
 * Client-side upload queue. Each file goes through its own XMLHttpRequest —
 * the one browser API with upload progress events — to the source's upload
 * route. `onQueueSettled` fires once every started upload has finished
 * (done, failed or canceled), which is the moment to refresh the listing.
 */
export function useUploads(
  sourceId: string,
  prefix: string,
  onQueueSettled: () => void,
) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const requests = useRef(new Map<string, XMLHttpRequest>());
  const active = useRef(0);

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }, []);

  const addFiles = useCallback(
    (inputs: Iterable<UploadInput>) => {
      for (const input of inputs) {
        const { file, path } =
          input instanceof File ? { file: input, path: input.name } : input;
        const id = crypto.randomUUID();
        setItems((prev) => [
          ...prev,
          {
            id,
            name: path,
            size: file.size,
            progress: 0,
            status: "uploading",
          },
        ]);

        const xhr = new XMLHttpRequest();
        requests.current.set(id, xhr);
        active.current += 1;

        const settle = () => {
          requests.current.delete(id);
          active.current -= 1;
          if (active.current === 0) onQueueSettled();
        };

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            patch(id, { progress: event.loaded / event.total });
          }
        };
        xhr.onload = () => {
          if (xhr.status === 201) {
            patch(id, { status: "done", progress: 1 });
          } else {
            patch(id, {
              status: "error",
              error: xhr.responseText || `Upload failed (${xhr.status}).`,
            });
          }
          settle();
        };
        xhr.onerror = () => {
          patch(id, { status: "error", error: "Network error." });
          settle();
        };
        xhr.onabort = () => {
          setItems((prev) => prev.filter((item) => item.id !== id));
          settle();
        };

        xhr.open("POST", uploadUrl(sourceId, prefix + path));
        xhr.send(file);
      }
    },
    [sourceId, prefix, onQueueSettled, patch],
  );

  const cancel = useCallback((id: string) => {
    requests.current.get(id)?.abort();
  }, []);

  /** Clears finished rows; anything still uploading stays. */
  const dismiss = useCallback(() => {
    setItems((prev) => prev.filter((item) => item.status === "uploading"));
  }, []);

  return { items, addFiles, cancel, dismiss };
}
