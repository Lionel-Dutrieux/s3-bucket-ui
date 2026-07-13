"use client";

import Link from "next/link";
import { Download, Folder, Info, Link2 } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { downloadHref } from "@/features/browser/components/browser-columns";
import { FileIcon } from "@/features/browser/components/file-icon";
import { isPreviewable } from "@/features/browser/components/preview-dialog";
import { categoryOf } from "@/features/browser/file-types";
import type { FileEntry, FolderEntry } from "@/features/browser/listing";

const GRID_ACTION_CLASS =
  "inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground";

export function FileGrid({
  sourceId,
  folders,
  files,
  onPreview,
  onCopyLink,
  onDetails,
}: {
  sourceId: string;
  folders: FolderEntry[];
  files: FileEntry[];
  onPreview: (file: FileEntry) => void;
  onCopyLink: (file: FileEntry) => void;
  onDetails: (file: FileEntry) => void;
}) {
  return (
    <div className="space-y-6">
      {folders.length > 0 ? (
        <section>
          <h3 className="mb-3 px-1 text-xs font-medium text-muted-foreground">
            Folders
          </h3>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
            {folders.map((folder) => (
              <Link
                key={folder.prefix}
                href={{
                  pathname: `/source/${sourceId}`,
                  query: { prefix: folder.prefix },
                }}
                title={folder.name}
                className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
                  <Folder
                    className="size-4.5 fill-amber-400/80 text-amber-500"
                    aria-hidden
                  />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium">{folder.name}</p>
                  <p className="text-xs text-muted-foreground">Folder</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {files.length > 0 ? (
        <section>
          <h3 className="mb-3 px-1 text-xs font-medium text-muted-foreground">
            Files
          </h3>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))]">
            {files.map((file) => (
              <div
                key={file.key}
                className="group relative overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50"
              >
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/40">
                  {categoryOf(file.name) === "image" ? (
                    // biome-ignore lint/performance/noImgElement: redirects to a presigned bucket URL, not optimizable
                    <img
                      src={`/source/${sourceId}/thumbnail?key=${encodeURIComponent(file.key)}`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <FileIcon
                      name={file.name}
                      className="size-10 transition-transform group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="space-y-0.5 border-t px-3 py-2">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>

                {/* Primary action stretched over the card; the hover actions
                    sit above it, so nothing interactive ends up nested. */}
                {isPreviewable(file.name) ? (
                  <button
                    type="button"
                    onClick={() => onPreview(file)}
                    title={`Preview ${file.name}`}
                    className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="sr-only">Preview {file.name}</span>
                  </button>
                ) : (
                  <a
                    href={downloadHref(sourceId, file.key)}
                    title={`Download ${file.name}`}
                    className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="sr-only">Download {file.name}</span>
                  </a>
                )}

                <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border bg-background/90 p-0.5 opacity-0 shadow-sm backdrop-blur transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => onDetails(file)}
                    className={GRID_ACTION_CLASS}
                    aria-label={`Details of ${file.name}`}
                    title="Details"
                  >
                    <Info className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onCopyLink(file)}
                    className={GRID_ACTION_CLASS}
                    aria-label={`Copy link to ${file.name}`}
                    title="Copy link"
                  >
                    <Link2 className="size-3.5" aria-hidden />
                  </button>
                  <a
                    href={downloadHref(sourceId, file.key)}
                    className={GRID_ACTION_CLASS}
                    aria-label={`Download ${file.name}`}
                    title="Download"
                  >
                    <Download className="size-3.5" aria-hidden />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
