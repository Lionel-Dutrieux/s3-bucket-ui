"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Download,
  Folder,
  Link2,
} from "lucide-react";
import { formatBytes, formatDate } from "@/lib/format";
import { FileIcon } from "@/features/browser/components/file-icon";
import { isPreviewable } from "@/features/browser/components/preview-dialog";
import type { FileEntry, FolderEntry } from "@/features/browser/listing";
import type { SortKey, SortState } from "@/features/browser/sort";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const NAME_CELL_CLASS = "flex h-12 w-full items-center gap-3 px-2 text-left";
const ROW_ACTION_CLASS =
  "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100";

export function FileTable({
  sourceId,
  folders,
  files,
  sort,
  onSort,
  onPreview,
  onCopyLink,
}: {
  sourceId: string;
  folders: FolderEntry[];
  files: FileEntry[];
  sort: SortState | null;
  onSort: (key: SortKey) => void;
  onPreview: (file: FileEntry) => void;
  onCopyLink: (file: FileEntry) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <SortableHead
            label="Name"
            sortKey="name"
            sort={sort}
            onSort={onSort}
          />
          <SortableHead
            label="Size"
            sortKey="size"
            sort={sort}
            onSort={onSort}
            className="w-28"
            align="right"
          />
          <SortableHead
            label="Modified"
            sortKey="modified"
            sort={sort}
            onSort={onSort}
            className="w-36"
            align="right"
          />
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {folders.map((folder) => (
          <TableRow key={folder.prefix} className="group">
            <TableCell className="p-0">
              <Link
                href={{
                  pathname: `/source/${sourceId}`,
                  query: { prefix: folder.prefix },
                }}
                className={cn(NAME_CELL_CLASS, "font-medium")}
              >
                <Folder
                  className="size-4 shrink-0 fill-amber-400/80 text-amber-500"
                  aria-hidden
                />
                <span className="truncate">{folder.name}</span>
              </Link>
            </TableCell>
            <TableCell className="text-right font-mono text-xs text-muted-foreground">
              —
            </TableCell>
            <TableCell className="text-right font-mono text-xs text-muted-foreground">
              —
            </TableCell>
            <TableCell />
          </TableRow>
        ))}
        {files.map((file) => {
          const downloadHref = `/source/${sourceId}/download?key=${encodeURIComponent(file.key)}`;
          const previewable = isPreviewable(file.name);
          return (
            <TableRow key={file.key} className="group">
              <TableCell className="p-0">
                {previewable ? (
                  <button
                    type="button"
                    onClick={() => onPreview(file)}
                    className={NAME_CELL_CLASS}
                    title={`Preview ${file.name}`}
                  >
                    <FileIcon name={file.name} className="size-4 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </button>
                ) : (
                  <a
                    href={downloadHref}
                    className={NAME_CELL_CLASS}
                    title={`Download ${file.name}`}
                  >
                    <FileIcon name={file.name} className="size-4 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </a>
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {formatBytes(file.size)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {formatDate(file.lastModified)}
              </TableCell>
              <TableCell className="p-0 pr-2 text-right">
                <button
                  type="button"
                  onClick={() => onCopyLink(file)}
                  className={ROW_ACTION_CLASS}
                  aria-label={`Copy link to ${file.name}`}
                  title="Copy link"
                >
                  <Link2 className="size-4" aria-hidden />
                </button>
                <a
                  href={downloadHref}
                  className={ROW_ACTION_CLASS}
                  aria-label={`Download ${file.name}`}
                  title="Download"
                >
                  <Download className="size-4" aria-hidden />
                </a>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
  align,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState | null;
  onSort: (key: SortKey) => void;
  className?: string;
  align?: "right";
}) {
  const active = sort?.key === sortKey;
  const Icon = !active
    ? ChevronsUpDown
    : sort.dir === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex h-full w-full items-center gap-1 hover:text-foreground",
          align === "right" && "justify-end",
          active && "text-foreground",
        )}
        aria-label={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}
