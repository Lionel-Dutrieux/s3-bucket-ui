"use client";

import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import { Download, Folder, Link2 } from "lucide-react";
import Link from "next/link";
import { FileIcon } from "@/features/browser/components/file-icon";
import { isPreviewable } from "@/features/browser/components/preview-dialog";
import {
  compareByModified,
  compareByName,
  compareBySize,
  type BrowserEntry,
} from "@/features/browser/entries";
import type { FileEntry } from "@/features/browser/listing";
import { formatBytes, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    sourceId: string;
    onPreview: (file: FileEntry) => void;
    onCopyLink: (file: FileEntry) => void;
  }
  interface ColumnMeta<TData extends RowData, TValue> {
    headClassName?: string;
    cellClassName?: string;
  }
}

export function downloadHref(sourceId: string, key: string): string {
  return `/source/${sourceId}/download?key=${encodeURIComponent(key)}`;
}

const NAME_CELL_CLASS = "flex h-12 w-full items-center gap-3 px-2 text-left";
const ROW_ACTION_CLASS =
  "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100";
const NUMERIC_CELL_CLASS = "text-right font-mono text-xs text-muted-foreground";

// Sorting is delegated to pure comparators; TanStack inverts them for the
// descending direction, and the table re-groups folders first afterwards.
const sortBy =
  (compare: (a: BrowserEntry, b: BrowserEntry) => number) =>
  (rowA: Row<BrowserEntry>, rowB: Row<BrowserEntry>) =>
    compare(rowA.original, rowB.original);

export const browserColumns: ColumnDef<BrowserEntry>[] = [
  {
    id: "name",
    header: "Name",
    accessorFn: (entry) => entry.name,
    sortingFn: sortBy(compareByName),
    meta: { cellClassName: "p-0" },
    cell: ({ row, table }) => {
      const entry = row.original;
      const { sourceId, onPreview } = table.options.meta ?? {};
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
              className="size-4 shrink-0 fill-amber-400/80 text-amber-500"
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
        <a
          href={downloadHref(sourceId ?? "", entry.key)}
          className={NAME_CELL_CLASS}
          title={`Download ${entry.name}`}
        >
          <FileIcon name={entry.name} className="size-4 shrink-0" />
          <span className="truncate">{entry.name}</span>
        </a>
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
      row.original.kind === "file"
        ? formatDate(row.original.lastModified)
        : "—",
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    meta: {
      headClassName: "w-20",
      cellClassName: "p-0 pr-2 text-right",
    },
    cell: ({ row, table }) => {
      const entry = row.original;
      if (entry.kind !== "file") return null;
      const { sourceId, onCopyLink } = table.options.meta ?? {};
      return (
        <>
          <button
            type="button"
            onClick={() => onCopyLink?.(entry)}
            className={ROW_ACTION_CLASS}
            aria-label={`Copy link to ${entry.name}`}
            title="Copy link"
          >
            <Link2 className="size-4" aria-hidden />
          </button>
          <a
            href={downloadHref(sourceId ?? "", entry.key)}
            className={ROW_ACTION_CLASS}
            aria-label={`Download ${entry.name}`}
            title="Download"
          >
            <Download className="size-4" aria-hidden />
          </a>
        </>
      );
    },
  },
];
