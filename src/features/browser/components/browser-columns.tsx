"use client";

import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import { Download, Folder, FolderDown } from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { downloadUrl, zipUrl } from "@/features/browser/api/client";
import { EntryActionsMenu } from "@/features/browser/components/entry-actions";
import { FileIcon } from "@/features/browser/components/file-icon";
import { InlineRenameInput } from "@/features/browser/components/inline-rename";
import {
  type BrowserEntry,
  compareByModified,
  compareByName,
  compareBySize,
} from "@/features/browser/lib/entries";
import type { FileEntry } from "@/features/browser/lib/listing";
import { isPreviewable } from "@/features/browser/lib/preview-kind";
import { formatBytes, formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    sourceId: string;
    onPreview: (file: FileEntry) => void;
    /** Absent when sharing is off (instance-wide setting) — hides the action. */
    onShare?: (file: FileEntry) => void;
    onDetails: (file: FileEntry) => void;
    /** Only set when the source allows deletions — absent hides the action.
     * Folders delete recursively (every object under the prefix). */
    onDelete?: (entry: BrowserEntry) => void;
    /** Only set when the source allows both upload and delete (rename moves
     * the object). */
    onRename?: (entry: BrowserEntry) => void;
    /** Only set when the viewer holds the edit capability (a duplicate
     * creates content). Files only. */
    onDuplicate?: (file: FileEntry) => void;
    /** Only set when the viewer can move entries (edit capability). */
    onMove?: (entry: BrowserEntry) => void;
    /** Row id (folder prefix / file key) currently renaming inline. */
    renamingId?: string | null;
    /** Ends the inline rename; true when a rename actually happened. */
    onRenameEnd?: (renamed: boolean) => void;
  }
  interface ColumnMeta<TData extends RowData, TValue> {
    headClassName?: string;
    cellClassName?: string;
  }
}

const NAME_CELL_CLASS = "flex h-12 w-full items-center gap-3 px-2 text-left";
// pointer-coarse keeps hover-revealed controls reachable on touch screens,
// where nothing ever hovers.
const ROW_ACTION_CLASS =
  "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100";
const NUMERIC_CELL_CLASS =
  "text-right text-xs text-muted-foreground tabular-nums";

// Sorting is delegated to pure comparators; TanStack inverts them for the
// descending direction, and the table re-groups folders first afterwards.
const sortBy =
  (compare: (a: BrowserEntry, b: BrowserEntry) => number) =>
  (rowA: Row<BrowserEntry>, rowB: Row<BrowserEntry>) =>
    compare(rowA.original, rowB.original);

/**
 * Leading checkbox column, prepended only when the source allows deletions.
 * The header checkbox acts on the visible (filtered) rows so a select-all
 * can never touch rows a name filter is hiding.
 */
export const selectColumn: ColumnDef<BrowserEntry> = {
  id: "select",
  enableSorting: false,
  meta: { headClassName: "w-10", cellClassName: "w-10" },
  header: ({ table }) => {
    const rows = table.getRowModel().rows;
    const allSelected =
      rows.length > 0 && rows.every((row) => row.getIsSelected());
    const someSelected = rows.some((row) => row.getIsSelected());
    return (
      <Checkbox
        checked={allSelected || (someSelected && "indeterminate")}
        onCheckedChange={(value) =>
          table.setRowSelection(
            value === true
              ? Object.fromEntries(rows.map((row) => [row.id, true]))
              : {},
          )
        }
        aria-label="Select all"
      />
    );
  },
  cell: ({ row, table }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(value === true)}
      aria-label={`Select ${row.original.name}`}
      className={cn(
        "transition-opacity",
        !row.getIsSelected() &&
          table.getSelectedRowModel().rows.length === 0 &&
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100",
      )}
    />
  ),
};

export const browserColumns: ColumnDef<BrowserEntry>[] = [
  {
    id: "name",
    header: "Name",
    accessorFn: (entry) => entry.name,
    sortingFn: sortBy(compareByName),
    meta: { cellClassName: "p-0" },
    cell: ({ row, table }) => {
      const entry = row.original;
      const { sourceId, onPreview, onDetails, renamingId, onRenameEnd } =
        table.options.meta ?? {};
      if (renamingId === row.id && sourceId && onRenameEnd) {
        return (
          <div className={NAME_CELL_CLASS}>
            {entry.kind === "folder" ? (
              <Folder
                className="size-4 shrink-0 fill-amber-400/80 text-primary"
                aria-hidden
              />
            ) : (
              <FileIcon name={entry.name} className="size-4 shrink-0" />
            )}
            <InlineRenameInput
              sourceId={sourceId}
              entry={entry}
              onEnd={onRenameEnd}
            />
          </div>
        );
      }
      if (entry.kind === "folder") {
        return (
          <Link
            href={{
              pathname: `/source/${sourceId}`,
              query: { prefix: entry.prefix },
            }}
            className={cn(NAME_CELL_CLASS, "font-medium")}
          >
            <Folder
              className="size-4 shrink-0 fill-amber-400/80 text-primary"
              aria-hidden
            />
            <span className="truncate">{entry.name}</span>
          </Link>
        );
      }
      return isPreviewable(entry.name) ? (
        <button
          type="button"
          onClick={() => onPreview?.(entry)}
          className={NAME_CELL_CLASS}
          title={`Preview ${entry.name}`}
        >
          <FileIcon name={entry.name} className="size-4 shrink-0" />
          <span className="truncate">{entry.name}</span>
        </button>
      ) : (
        // No preview for this type → open its details, never a surprise
        // download (that stays an explicit action).
        <button
          type="button"
          onClick={() => onDetails?.(entry)}
          className={NAME_CELL_CLASS}
          title={`Details of ${entry.name}`}
        >
          <FileIcon name={entry.name} className="size-4 shrink-0" />
          <span className="truncate">{entry.name}</span>
        </button>
      );
    },
  },
  {
    id: "size",
    header: "Size",
    accessorFn: (entry) => (entry.kind === "file" ? entry.size : null),
    sortingFn: sortBy(compareBySize),
    meta: {
      headClassName: "w-28",
      cellClassName: NUMERIC_CELL_CLASS,
    },
    cell: ({ row }) =>
      row.original.kind === "file" ? formatBytes(row.original.size) : "—",
  },
  {
    id: "modified",
    header: "Modified",
    accessorFn: (entry) =>
      entry.kind === "file" ? (entry.lastModified ?? null) : null,
    sortingFn: sortBy(compareByModified),
    meta: {
      headClassName: "w-36",
      cellClassName: NUMERIC_CELL_CLASS,
    },
    cell: ({ row }) =>
      row.original.kind === "file" && row.original.lastModified ? (
        // Relative reads faster; the exact date lives in the tooltip. The
        // wall clock shifts between server render and hydration — suppress
        // the (harmless) mismatch.
        <span
          title={formatDate(row.original.lastModified)}
          suppressHydrationWarning
        >
          {formatRelative(row.original.lastModified)}
        </span>
      ) : (
        "—"
      ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    meta: {
      headClassName: "w-20",
      cellClassName: "p-0 pr-2 text-right",
    },
    // One quick action (download) + a kebab holding everything else —
    // the same menu the right-click opens.
    cell: ({ row, table }) => {
      const entry = row.original;
      const meta = table.options.meta;
      if (!meta) return null;

      return (
        <>
          {entry.kind === "folder" ? (
            <a
              href={zipUrl(meta.sourceId, entry.prefix)}
              className={ROW_ACTION_CLASS}
              aria-label={`Download ${entry.name} as ZIP`}
              title="Download as ZIP"
            >
              <FolderDown className="size-4" aria-hidden />
            </a>
          ) : (
            <a
              href={downloadUrl(meta.sourceId, entry.key)}
              className={ROW_ACTION_CLASS}
              aria-label={`Download ${entry.name}`}
              title="Download"
            >
              <Download className="size-4" aria-hidden />
            </a>
          )}
          <EntryActionsMenu
            entry={entry}
            handlers={meta}
            className={cn(ROW_ACTION_CLASS, "data-open:opacity-100")}
          />
        </>
      );
    },
  },
];
