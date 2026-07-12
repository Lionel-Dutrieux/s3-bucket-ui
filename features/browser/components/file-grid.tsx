"use client";

import Link from "next/link";
import { Folder } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { FileIcon } from "@/features/browser/components/file-icon";
import { isPreviewable } from "@/features/browser/components/preview-dialog";
import type { FileEntry, FolderEntry } from "@/features/browser/listing";

const CARD_CLASS =
  "group block w-full overflow-hidden rounded-lg border bg-card text-left transition-colors hover:bg-muted/50";

export function FileGrid({
  sourceId,
  folders,
  files,
  onPreview,
}: {
  sourceId: string;
  folders: FolderEntry[];
  files: FileEntry[];
  onPreview: (file: FileEntry) => void;
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
            {files.map((file) => {
              const body = (
                <>
                  <div className="flex aspect-[4/3] items-center justify-center bg-muted/40">
                    <FileIcon
                      name={file.name}
                      className="size-10 transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="space-y-0.5 border-t px-3 py-2">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                </>
              );
              return isPreviewable(file.name) ? (
                <button
                  key={file.key}
                  type="button"
                  onClick={() => onPreview(file)}
                  title={`Preview ${file.name}`}
                  className={CARD_CLASS}
                >
                  {body}
                </button>
              ) : (
                <a
                  key={file.key}
                  href={`/source/${sourceId}/download?key=${encodeURIComponent(file.key)}`}
                  title={`Download ${file.name}`}
                  className={CARD_CLASS}
                >
                  {body}
                </a>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
