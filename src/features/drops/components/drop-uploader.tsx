"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { dropUploadUrl } from "@/features/drops/api/client";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

type ItemStatus = "queued" | "uploading" | "done" | "error";

interface Item {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: ItemStatus;
  error?: string;
}

const MAX_PARALLEL = 3;
const MB = 1024 * 1024;

/**
 * The guest-facing deposit surface for a drop link: a drag-and-drop zone plus a
 * file picker, one progress bar per file (XHR — the only browser API with
 * upload progress), and a running success count. It shows the owner's note and
 * the link's limits, and it NEVER lists or reveals the prefix's existing
 * contents — a guest only ever adds.
 */
export function DropUploader({
  token,
  note,
  maxSizeMb,
  remaining,
}: {
  token: string;
  note: string | null;
  maxSizeMb: number | null;
  /** Deposits still allowed (maxFiles − uploadsCount), or null when unlimited. */
  remaining: number | null;
}) {
  const t = useTranslations("drops.publicUploader");
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef(0);
  const queueRef = useRef<string[]>([]);
  const itemsRef = useRef<Map<string, Item>>(new Map());

  const doneCount = items.filter((item) => item.status === "done").length;
  // A full link is closed to new deposits — server enforces it too.
  const capReached = remaining !== null && remaining - doneCount <= 0;
  const maxBytes = maxSizeMb ? maxSizeMb * MB : null;

  const patch = useCallback((id: string, changes: Partial<Item>) => {
    const current = itemsRef.current.get(id);
    if (current) itemsRef.current.set(id, { ...current, ...changes });
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }, []);

  const pump = useCallback(() => {
    while (activeRef.current < MAX_PARALLEL) {
      const id = queueRef.current.shift();
      if (id === undefined) break;
      const item = itemsRef.current.get(id);
      if (!item) continue;

      activeRef.current += 1;
      patch(id, { status: "uploading", progress: 0 });

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          patch(id, { progress: event.loaded / event.total });
        }
      };
      const settle = () => {
        activeRef.current -= 1;
        pump();
      };
      xhr.onload = () => {
        if (xhr.status === 201) {
          patch(id, { status: "done", progress: 1 });
        } else {
          let message = t("uploadError");
          try {
            const body = JSON.parse(xhr.responseText) as { error?: string };
            if (body.error) message = body.error;
          } catch {
            // Non-JSON response — keep the generic message.
          }
          patch(id, { status: "error", error: message });
        }
        settle();
      };
      xhr.onerror = () => {
        patch(id, { status: "error", error: t("networkError") });
        settle();
      };
      xhr.open("POST", dropUploadUrl(token, item.name));
      xhr.setRequestHeader(
        "content-type",
        item.file.type || "application/octet-stream",
      );
      xhr.send(item.file);
    }
  }, [patch, t, token]);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const added: Item[] = [];
      for (const file of files) {
        const id = crypto.randomUUID();
        const oversize = maxBytes !== null && file.size > maxBytes;
        const item: Item = {
          id,
          file,
          name: file.name,
          size: file.size,
          progress: 0,
          status: oversize ? "error" : "queued",
          error: oversize
            ? t("tooLargeClient", { max: maxSizeMb ?? 0 })
            : undefined,
        };
        itemsRef.current.set(id, item);
        added.push(item);
        if (!oversize) queueRef.current.push(id);
      }
      if (added.length === 0) return;
      setItems((prev) => [...prev, ...added]);
      pump();
    },
    [maxBytes, maxSizeMb, pump, t],
  );

  const removeItem = useCallback((id: string) => {
    itemsRef.current.delete(id);
    queueRef.current = queueRef.current.filter((queued) => queued !== id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-base font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {note ? (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
          <p className="whitespace-pre-wrap break-words">{note}</p>
        </div>
      ) : null}

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {maxSizeMb ? <li>{t("limitSize", { max: maxSizeMb })}</li> : null}
        {remaining !== null ? (
          <li>
            {t("limitRemaining", { count: Math.max(remaining - doneCount, 0) })}
          </li>
        ) : null}
      </ul>

      {capReached ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {t("full")}
        </div>
      ) : (
        // biome-ignore lint/a11y/noStaticElementInteractions: drop zone also has a button + input for keyboard/AT users
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files.length) {
              addFiles(event.dataTransfer.files);
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-muted",
          )}
        >
          <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t("dropHint")}</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <FileUp aria-hidden />
            {t("chooseFiles")}
          </Button>
        </div>
      )}

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-md border bg-card p-3"
            >
              <StatusIcon status={item.status} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="truncate text-sm font-medium"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatBytes(item.size)}
                  </span>
                </div>
                {item.status === "uploading" ? (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-[width]"
                      style={{ width: `${Math.round(item.progress * 100)}%` }}
                    />
                  </div>
                ) : null}
                {item.status === "error" ? (
                  <p className="mt-1 text-xs text-destructive">{item.error}</p>
                ) : null}
                {item.status === "done" ? (
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    {t("uploaded")}
                  </p>
                ) : null}
              </div>
              {item.status === "error" || item.status === "done" ? (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t("dismiss", { name: item.name })}
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {doneCount > 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {t("successSummary", { count: doneCount })}
        </div>
      ) : null}
    </div>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "done") {
    return (
      <CheckCircle2
        className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
        aria-hidden
      />
    );
  }
  if (status === "error") {
    return (
      <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />
    );
  }
  if (status === "uploading") {
    return (
      <Loader2
        className="size-5 shrink-0 animate-spin text-muted-foreground"
        aria-hidden
      />
    );
  }
  return (
    <FileUp className="size-5 shrink-0 text-muted-foreground" aria-hidden />
  );
}
