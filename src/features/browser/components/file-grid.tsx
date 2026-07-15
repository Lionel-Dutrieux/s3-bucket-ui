"use client";

import {
  Copy,
  Download,
  Folder,
  FolderDown,
  Info,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import {
  downloadUrl,
  thumbnailSrc,
  zipUrl,
} from "@/features/browser/api/client";
import { useEntryDnd } from "@/features/browser/components/dnd";
import { FileIcon } from "@/features/browser/components/file-icon";
import type { BrowserEntry } from "@/features/browser/lib/entries";
import { categoryOf } from "@/features/browser/lib/file-types";
import type { FileEntry, FolderEntry } from "@/features/browser/lib/listing";
import { isPreviewable } from "@/features/browser/lib/preview-kind";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

const GRID_ACTION_CLASS =
  "inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground";

/** "TAR.GZ" for archive.tar.gz, "SQLITE3" for dump.sqlite3, null for README. */
function extensionOf(name: string): string | null {
  const match = /\.([a-z0-9]{1,7}(?:\.[a-z0-9]{1,4})?)$/i.exec(name);
  return match ? match[1].toUpperCase() : null;
}

/** Multi-select wiring, present only when the source allows deletions.
 * Ids are the row ids the table uses: folder prefix or file key. */
export interface GridSelection {
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  /** True while anything is selected — keeps every checkbox visible. */
  active: boolean;
}

export function FileGrid({
  sourceId,
  folders,
  files,
  onPreview,
  onShare,
  onDetails,
  onDelete,
  onRename,
  onDuplicate,
  selection,
  canMove = false,
}: {
  sourceId: string;
  folders: FolderEntry[];
  files: FileEntry[];
  onPreview: (file: FileEntry) => void;
  /** Absent when sharing is off (instance-wide setting) — hides the action. */
  onShare?: (file: FileEntry) => void;
  onDetails: (file: FileEntry) => void;
  /** Only set when the source allows deletions — absent hides the action.
   * Folders delete recursively (every object under the prefix). */
  onDelete?: (entry: BrowserEntry) => void;
  /** Only set when the source allows both upload and delete. */
  onRename?: (entry: BrowserEntry) => void;
  /** Only set when the viewer holds the edit capability. Files only. */
  onDuplicate?: (file: FileEntry) => void;
  selection?: GridSelection;
  canMove?: boolean;
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
              <FolderCard
                key={folder.prefix}
                sourceId={sourceId}
                folder={folder}
                canMove={canMove}
                selection={selection}
                onRename={onRename}
                onDelete={onDelete}
              />
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
              <FileCard
                key={file.key}
                sourceId={sourceId}
                file={file}
                canMove={canMove}
                selection={selection}
                onPreview={onPreview}
                onShare={onShare}
                onDetails={onDetails}
                onRename={onRename}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FolderCard({
  sourceId,
  folder,
  canMove,
  selection,
  onRename,
  onDelete,
}: {
  sourceId: string;
  folder: FolderEntry;
  canMove: boolean;
  selection?: GridSelection;
  onRename?: (entry: BrowserEntry) => void;
  onDelete?: (entry: BrowserEntry) => void;
}) {
  const dnd = useEntryDnd({
    rowId: folder.prefix,
    data: {
      target: { kind: "folder", prefix: folder.prefix },
      label: folder.name,
      rowId: folder.prefix,
    },
    droppablePrefix: folder.prefix,
    disabled: !canMove,
  });

  return (
    <div
      ref={canMove ? dnd.setNodeRef : undefined}
      {...(canMove ? dnd.attributes : {})}
      {...(canMove ? dnd.listeners : {})}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg border bg-card px-3.5 py-3 transition-colors hover:bg-muted/50",
        canMove && "cursor-grab",
        dnd.isDragging && "opacity-40",
        dnd.isOver && "outline outline-2 outline-primary",
      )}
    >
      {/* When selection is on, hovering swaps the folder icon for
          its checkbox — the Drive pattern. */}
      <div className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
        {selection ? (
          <>
            <Folder
              className={cn(
                "size-4.5 fill-amber-400/80 text-primary",
                selection.active || selection.isSelected(folder.prefix)
                  ? "hidden"
                  : "group-hover:hidden pointer-coarse:hidden",
              )}
              aria-hidden
            />
            <Checkbox
              checked={selection.isSelected(folder.prefix)}
              onCheckedChange={() => selection.toggle(folder.prefix)}
              aria-label={`Select ${folder.name}`}
              className={cn(
                "bg-background",
                selection.active || selection.isSelected(folder.prefix)
                  ? undefined
                  : "hidden group-hover:flex pointer-coarse:flex",
              )}
            />
          </>
        ) : (
          <Folder
            className="size-4.5 fill-amber-400/80 text-primary"
            aria-hidden
          />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">{folder.name}</p>
        <p className="text-xs text-muted-foreground">Folder</p>
      </div>
      {/* Overlay link keeps the whole card clickable without
          nesting the delete button inside it. */}
      <Link
        href={{
          pathname: `/source/${sourceId}`,
          query: { prefix: folder.prefix },
        }}
        title={folder.name}
        className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="sr-only">Open {folder.name}</span>
      </Link>
      <a
        href={zipUrl(sourceId, folder.prefix)}
        className={`${GRID_ACTION_CLASS} relative z-10 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100`}
        aria-label={`Download ${folder.name} as ZIP`}
        title="Download as ZIP"
      >
        <FolderDown className="size-3.5" aria-hidden />
      </a>
      {onRename ? (
        <button
          type="button"
          onClick={() => onRename({ kind: "folder", ...folder })}
          className={`${GRID_ACTION_CLASS} relative z-10 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100`}
          aria-label={`Rename ${folder.name}`}
          title="Rename"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={() => onDelete({ kind: "folder", ...folder })}
          className={`${GRID_ACTION_CLASS} relative z-10 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 hover:text-destructive`}
          aria-label={`Delete ${folder.name}`}
          title="Delete folder"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function FileCard({
  sourceId,
  file,
  canMove,
  selection,
  onPreview,
  onShare,
  onDetails,
  onRename,
  onDuplicate,
  onDelete,
}: {
  sourceId: string;
  file: FileEntry;
  canMove: boolean;
  selection?: GridSelection;
  onPreview: (file: FileEntry) => void;
  onShare?: (file: FileEntry) => void;
  onDetails: (file: FileEntry) => void;
  onRename?: (entry: BrowserEntry) => void;
  onDuplicate?: (file: FileEntry) => void;
  onDelete?: (entry: BrowserEntry) => void;
}) {
  const dnd = useEntryDnd({
    rowId: file.key,
    data: {
      target: { kind: "file", key: file.key },
      label: file.name,
      rowId: file.key,
    },
    disabled: !canMove,
  });

  return (
    <div
      ref={canMove ? dnd.setNodeRef : undefined}
      {...(canMove ? dnd.attributes : {})}
      {...(canMove ? dnd.listeners : {})}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50",
        canMove && "cursor-grab",
        dnd.isDragging && "opacity-40",
      )}
    >
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/40">
        {categoryOf(file.name) === "image" ? (
          // biome-ignore lint/performance/noImgElement: redirects to a presigned bucket URL, not optimizable
          <img
            src={thumbnailSrc(sourceId, file.key)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 transition-transform group-hover:scale-105">
            <FileIcon name={file.name} className="size-12" />
            {extensionOf(file.name) ? (
              <span className="rounded-md border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                {extensionOf(file.name)}
              </span>
            ) : null}
          </div>
        )}
      </div>
      <div className="space-y-0.5 border-t px-3 py-2">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {formatBytes(file.size)}
        </p>
      </div>

      {/* Primary action stretched over the card; the hover actions sit
          above it, so nothing interactive ends up nested. Non-previewable
          files open their details — never a surprise download. */}
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
        <button
          type="button"
          onClick={() => onDetails(file)}
          title={`Details of ${file.name}`}
          className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="sr-only">Details of {file.name}</span>
        </button>
      )}

      {selection ? (
        <Checkbox
          checked={selection.isSelected(file.key)}
          onCheckedChange={() => selection.toggle(file.key)}
          aria-label={`Select ${file.name}`}
          className={cn(
            "absolute left-2 top-2 z-10 bg-background/90 shadow-sm backdrop-blur transition-opacity",
            selection.active || selection.isSelected(file.key)
              ? undefined
              : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100",
          )}
        />
      ) : null}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border bg-background/90 p-0.5 opacity-0 shadow-sm backdrop-blur transition-opacity focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
        <button
          type="button"
          onClick={() => onDetails(file)}
          className={GRID_ACTION_CLASS}
          aria-label={`Details of ${file.name}`}
          title="Details"
        >
          <Info className="size-3.5" aria-hidden />
        </button>
        {onShare ? (
          <button
            type="button"
            onClick={() => onShare(file)}
            className={GRID_ACTION_CLASS}
            aria-label={`Share ${file.name}`}
            title="Share"
          >
            <Share2 className="size-3.5" aria-hidden />
          </button>
        ) : null}
        <a
          href={downloadUrl(sourceId, file.key)}
          className={GRID_ACTION_CLASS}
          aria-label={`Download ${file.name}`}
          title="Download"
        >
          <Download className="size-3.5" aria-hidden />
        </a>
        {onDuplicate ? (
          <button
            type="button"
            onClick={() => onDuplicate(file)}
            className={GRID_ACTION_CLASS}
            aria-label={`Duplicate ${file.name}`}
            title="Duplicate"
          >
            <Copy className="size-3.5" aria-hidden />
          </button>
        ) : null}
        {onRename ? (
          <button
            type="button"
            onClick={() => onRename({ kind: "file", ...file })}
            className={GRID_ACTION_CLASS}
            aria-label={`Rename ${file.name}`}
            title="Rename"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete({ kind: "file", ...file })}
            className={`${GRID_ACTION_CLASS} hover:text-destructive`}
            aria-label={`Delete ${file.name}`}
            title="Delete"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
