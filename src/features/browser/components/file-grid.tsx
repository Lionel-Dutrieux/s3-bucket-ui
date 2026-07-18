"use client";

import { Folder } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { thumbnailSrc } from "@/features/browser/api/client";
import { useEntryDnd } from "@/features/browser/components/dnd";
import { EntryName } from "@/features/browser/components/entry-name";
import { FileIcon } from "@/features/browser/components/file-icon";
import { InlineRenameInput } from "@/features/browser/components/inline-rename";
import {
  EntryActionsMenu,
  EntryContextMenu,
} from "@/features/browser/components/menus/entry-actions";
import type { BrowserEntry } from "@/features/browser/lib/entries";
import { categoryOf } from "@/features/browser/lib/file-types";
import type { FileEntry, FolderEntry } from "@/features/browser/lib/listing";
import { isPreviewable } from "@/features/browser/lib/preview-kind";
import {
  CHECKERBOARD_CLASS,
  isVectorImage,
} from "@/features/browser/lib/thumbs";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

// Hidden until hover; pointer-coarse keeps it reachable on touch screens,
// and data-open keeps it visible while its menu is up.
const GRID_KEBAB_CLASS =
  "size-7 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 data-open:opacity-100";

/** "TAR.GZ" for archive.tar.gz, "SQLITE3" for dump.sqlite3, null for README. */
function extensionOf(name: string): string | null {
  const match = /\.([a-z0-9]{1,7}(?:\.[a-z0-9]{1,4})?)$/i.exec(name);
  return match ? match[1].toUpperCase() : null;
}

/** Multi-select wiring. Ids are the row ids the table uses: folder prefix or
 * file key. */
export interface GridSelection {
  isSelected: (id: string) => boolean;
  /** Shift-clicks extend the selection to the whole visible range. */
  toggle: (id: string, shift: boolean) => void;
  /** True while anything is selected — keeps every checkbox visible. */
  active: boolean;
}

/** Shift/Ctrl/Cmd+click means "select", wherever it lands on the card — the
 * Drive gesture. Returns true when the event was consumed as a selection. */
function selectionClick(
  selection: GridSelection | undefined,
  id: string,
  event: React.MouseEvent,
): boolean {
  if (!selection || !(event.shiftKey || event.ctrlKey || event.metaKey)) {
    return false;
  }
  event.preventDefault();
  selection.toggle(id, event.shiftKey);
  return true;
}

export function FileGrid({
  sourceId,
  folders,
  files,
  onPreview,
  onShare,
  onShareFolder,
  onCreateDrop,
  onDetails,
  onDelete,
  onRename,
  onDuplicate,
  onMove,
  selection,
  canMove = false,
  renamingId,
  onRenameEnd,
  activeId,
}: {
  sourceId: string;
  folders: FolderEntry[];
  files: FileEntry[];
  onPreview: (file: FileEntry) => void;
  /** Absent when sharing is off (instance-wide setting) — hides the action. */
  onShare?: (file: FileEntry) => void;
  /** Share a whole folder — absent when sharing is off. */
  onShareFolder?: (folder: FolderEntry) => void;
  /** Mint a deposit link for a folder — absent when drop links are off. */
  onCreateDrop?: (folder: FolderEntry) => void;
  onDetails: (file: FileEntry) => void;
  /** Only set when the source allows deletions — absent hides the action.
   * Folders delete recursively (every object under the prefix). */
  onDelete?: (entry: BrowserEntry) => void;
  /** Only set when the source allows both upload and delete. */
  onRename?: (entry: BrowserEntry) => void;
  /** Only set when the viewer holds the edit capability. Files only. */
  onDuplicate?: (file: FileEntry) => void;
  /** Only set when the viewer can move entries (edit capability). */
  onMove?: (entry: BrowserEntry) => void;
  selection?: GridSelection;
  canMove?: boolean;
  /** Card id (folder prefix / file key) currently renaming inline. */
  renamingId?: string | null;
  /** Ends the inline rename; true when a rename actually happened. */
  onRenameEnd?: (renamed: boolean) => void;
  /** File key whose details panel is open — its card stays highlighted. */
  activeId?: string | null;
}) {
  const t = useTranslations("browser.grid");
  return (
    <div className="space-y-6">
      {folders.length > 0 ? (
        <section>
          <h3 className="mb-3 px-1 text-xs font-medium text-muted-foreground">
            {t("foldersHeading")}
          </h3>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
            {folders.map((folder) => (
              <FolderCard
                key={folder.prefix}
                sourceId={sourceId}
                folder={folder}
                canMove={canMove}
                selection={selection}
                onShareFolder={onShareFolder}
                onCreateDrop={onCreateDrop}
                onRename={onRename}
                onDelete={onDelete}
                onMove={onMove}
                renaming={renamingId === folder.prefix}
                onRenameEnd={onRenameEnd}
              />
            ))}
          </div>
        </section>
      ) : null}

      {files.length > 0 ? (
        <section>
          <h3 className="mb-3 px-1 text-xs font-medium text-muted-foreground">
            {t("filesHeading")}
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
                onMove={onMove}
                renaming={renamingId === file.key}
                onRenameEnd={onRenameEnd}
                active={activeId === file.key}
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
  onShareFolder,
  onCreateDrop,
  onRename,
  onDelete,
  onMove,
  renaming = false,
  onRenameEnd,
}: {
  sourceId: string;
  folder: FolderEntry;
  canMove: boolean;
  selection?: GridSelection;
  onShareFolder?: (folder: FolderEntry) => void;
  onCreateDrop?: (folder: FolderEntry) => void;
  onRename?: (entry: BrowserEntry) => void;
  onDelete?: (entry: BrowserEntry) => void;
  onMove?: (entry: BrowserEntry) => void;
  renaming?: boolean;
  onRenameEnd?: (renamed: boolean) => void;
}) {
  const t = useTranslations("browser.grid");
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
  const entry = { kind: "folder" as const, ...folder };
  const handlers = {
    sourceId,
    onShareFolder,
    onCreateDrop,
    onRename,
    onDelete,
    onMove,
  };

  return (
    <EntryContextMenu entry={entry} handlers={handlers}>
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
                onClick={(event) => {
                  event.preventDefault();
                  selection.toggle(folder.prefix, event.shiftKey);
                }}
                aria-label={t("selectEntry", { name: folder.name })}
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
          {renaming && onRenameEnd ? (
            <InlineRenameInput
              sourceId={sourceId}
              entry={entry}
              onEnd={onRenameEnd}
              className="relative z-10"
            />
          ) : (
            // The section heading and the icon already say "folder" — no
            // subtitle repeating it a third time.
            <p className="truncate text-sm font-medium">{folder.name}</p>
          )}
        </div>
        {/* Overlay link keeps the whole card clickable without
          nesting the delete button inside it. */}
        <Link
          href={{
            pathname: `/source/${sourceId}`,
            query: { prefix: folder.prefix },
          }}
          // Modifier-clicks select instead of navigating (a shift-click on a
          // bare link would even pop a new window).
          onClick={(event) => selectionClick(selection, folder.prefix, event)}
          title={folder.name}
          className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="sr-only">
            {t("openFolder", { name: folder.name })}
          </span>
        </Link>
        <EntryActionsMenu
          entry={entry}
          handlers={handlers}
          className={cn(GRID_KEBAB_CLASS, "relative z-10")}
        />
      </div>
    </EntryContextMenu>
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
  onMove,
  renaming = false,
  onRenameEnd,
  active = false,
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
  onMove?: (entry: BrowserEntry) => void;
  renaming?: boolean;
  onRenameEnd?: (renamed: boolean) => void;
  /** True while this file's details panel is open. */
  active?: boolean;
}) {
  const t = useTranslations("browser.grid");
  const dnd = useEntryDnd({
    rowId: file.key,
    data: {
      target: { kind: "file", key: file.key },
      label: file.name,
      rowId: file.key,
    },
    disabled: !canMove,
  });
  const entry = { kind: "file" as const, ...file };
  const handlers = {
    sourceId,
    onPreview,
    onShare,
    onDetails,
    onRename,
    onDuplicate,
    onDelete,
    onMove,
  };

  return (
    <EntryContextMenu entry={entry} handlers={handlers}>
      <div
        ref={canMove ? dnd.setNodeRef : undefined}
        {...(canMove ? dnd.attributes : {})}
        {...(canMove ? dnd.listeners : {})}
        className={cn(
          "group relative overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50",
          canMove && "cursor-grab",
          dnd.isDragging && "opacity-40",
          // The details panel names its file, but the grid must show WHICH
          // card it belongs to — the link survives scrolling.
          active && "border-primary/60 ring-1 ring-primary/60",
        )}
      >
        <div
          className={cn(
            "flex aspect-[4/3] items-center justify-center overflow-hidden",
            categoryOf(file.name) === "image"
              ? CHECKERBOARD_CLASS
              : "bg-muted/40",
          )}
        >
          {categoryOf(file.name) === "image" ? (
            // biome-ignore lint/performance/noImgElement: redirects to a presigned bucket URL, not optimizable
            <img
              src={thumbnailSrc(sourceId, file.key)}
              alt=""
              loading="lazy"
              className={cn(
                "h-full w-full transition-transform group-hover:scale-105",
                isVectorImage(file.name)
                  ? "object-contain p-4"
                  : "object-cover",
              )}
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
          {renaming && onRenameEnd ? (
            <InlineRenameInput
              sourceId={sourceId}
              entry={entry}
              onEnd={onRenameEnd}
              className="relative z-10"
            />
          ) : (
            <EntryName name={file.name} className="text-sm font-medium" />
          )}
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatBytes(file.size)}
          </p>
        </div>

        {/* Primary action stretched over the card; the hover actions sit
          above it, so nothing interactive ends up nested. Non-previewable
          files open their details — never a surprise download. */}
        {isPreviewable(file.name) ? (
          <button
            type="button"
            onClick={(event) => {
              if (selectionClick(selection, file.key, event)) return;
              onPreview(file);
            }}
            title={t("previewFile", { name: file.name })}
            className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="sr-only">
              {t("previewFile", { name: file.name })}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(event) => {
              if (selectionClick(selection, file.key, event)) return;
              onDetails(file);
            }}
            title={t("detailsOf", { name: file.name })}
            className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="sr-only">
              {t("detailsOf", { name: file.name })}
            </span>
          </button>
        )}

        {selection ? (
          <Checkbox
            checked={selection.isSelected(file.key)}
            onClick={(event) => {
              event.preventDefault();
              selection.toggle(file.key, event.shiftKey);
            }}
            aria-label={t("selectEntry", { name: file.name })}
            className={cn(
              "absolute left-2 top-2 z-10 bg-background/90 shadow-sm backdrop-blur transition-opacity",
              selection.active || selection.isSelected(file.key)
                ? undefined
                : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100",
            )}
          />
        ) : null}
        <EntryActionsMenu
          entry={entry}
          handlers={handlers}
          className={cn(
            GRID_KEBAB_CLASS,
            "absolute right-2 top-2 z-10 rounded-md border bg-background/90 shadow-sm backdrop-blur",
          )}
        />
      </div>
    </EntryContextMenu>
  );
}
