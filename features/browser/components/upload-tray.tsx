"use client";

import { Check, ChevronDown, CircleAlert, X } from "lucide-react";
import { useState } from "react";
import { FileIcon } from "@/features/browser/components/file-icon";
import type { UploadItem } from "@/features/browser/use-uploads";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Floating upload queue, bottom right. Rows reuse the table's vocabulary —
 * file icon, truncated name, mono figures — with a thin progress bar per
 * file. Stays up after completion until dismissed, so errors aren't lost.
 */
export function UploadTray({
  items,
  onCancel,
  onDismiss,
}: {
  items: UploadItem[];
  onCancel: (id: string) => void;
  onDismiss: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  const uploading = items.filter((item) => item.status === "uploading").length;
  const failed = items.filter((item) => item.status === "error").length;
  const title =
    uploading > 0
      ? `Uploading ${uploading} file${uploading === 1 ? "" : "s"}…`
      : failed > 0
        ? `${failed} upload${failed === 1 ? "" : "s"} failed`
        : `${items.length} upload${items.length === 1 ? "" : "s"} complete`;

  return (
    <section
      className="fixed bottom-4 right-4 z-50 w-80 overflow-hidden rounded-lg border bg-card shadow-lg"
      aria-label="Uploads"
    >
      <header className="flex h-10 items-center gap-2 border-b bg-muted/40 pl-3 pr-1.5">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expand uploads" : "Collapse uploads"}
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              collapsed && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        {uploading === 0 ? (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss uploads"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </header>

      {!collapsed ? (
        <ul className="max-h-64 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="border-b px-3 py-2 last:border-b-0">
              <div className="flex items-center gap-2.5">
                <FileIcon name={item.name} className="size-4 shrink-0" />
                <p className="min-w-0 flex-1 truncate text-sm">{item.name}</p>
                {item.status === "uploading" ? (
                  <>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {Math.round(item.progress * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => onCancel(item.id)}
                      className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Cancel upload of ${item.name}`}
                      title="Cancel"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </>
                ) : item.status === "done" ? (
                  <>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatBytes(item.size)}
                    </span>
                    <Check className="size-4 text-emerald-500" aria-hidden />
                  </>
                ) : (
                  <CircleAlert
                    className="size-4 shrink-0 text-destructive"
                    aria-hidden
                  />
                )}
              </div>
              {item.status === "uploading" ? (
                <div
                  className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={Math.round(item.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Upload progress for ${item.name}`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200"
                    style={{ width: `${item.progress * 100}%` }}
                  />
                </div>
              ) : item.status === "error" ? (
                <p className="mt-1 text-xs text-destructive">{item.error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
