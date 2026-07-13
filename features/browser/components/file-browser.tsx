"use client";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { Search, SearchX } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getShareUrl } from "@/features/browser/actions";
import { browserColumns } from "@/features/browser/components/browser-columns";
import { DetailsDialog } from "@/features/browser/components/details-dialog";
import { FileGrid } from "@/features/browser/components/file-grid";
import { FileTable } from "@/features/browser/components/file-table";
import { PreviewDialog } from "@/features/browser/components/preview-dialog";
import { buildEntries, entryMatches } from "@/features/browser/entries";
import type { FileEntry, FolderEntry } from "@/features/browser/listing";
import { sortParser } from "@/features/browser/sort-param";
import type { ViewMode } from "@/features/browser/view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Client shell around the listing: one TanStack Table instance filters and
 * sorts the entries the server already loaded (this page only). The list view
 * renders the table; the grid view consumes the same row model, so search and
 * sort apply to both. Filter and sort live in the URL (?q=, ?sort=) so a
 * refresh or a shared link keeps them. Also owns the preview and details
 * dialogs.
 */
export function FileBrowser({
  sourceId,
  folders,
  files,
  view,
}: {
  sourceId: string;
  folders: FolderEntry[];
  files: FileEntry[];
  view: ViewMode;
}) {
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [sorting, setSorting] = useQueryState(
    "sort",
    sortParser.withDefault([]),
  );
  const [preview, setPreview] = useState<FileEntry | null>(null);
  const [details, setDetails] = useState<FileEntry | null>(null);

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((prev) =>
      typeof updater === "function" ? updater(prev) : updater,
    );
  };

  const handleCopyLink = async (file: FileEntry) => {
    const result = await getShareUrl(sourceId, file.key);
    if (!result.url) {
      toast.error(result.error ?? "Could not create a link.");
      return;
    }
    await navigator.clipboard.writeText(result.url);
    toast.success("Link copied — valid for 1 hour");
  };

  const entries = useMemo(() => buildEntries(folders, files), [folders, files]);

  const table = useReactTable({
    data: entries,
    columns: browserColumns,
    state: { sorting, globalFilter: query },
    onSortingChange: handleSortingChange,
    onGlobalFilterChange: (updater) =>
      setQuery((prev) =>
        String(typeof updater === "function" ? updater(prev) : (updater ?? "")),
      ),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, value) =>
      entryMatches(row.original, String(value)),
    sortDescFirst: false,
    enableMultiSort: false,
    meta: {
      sourceId,
      onPreview: setPreview,
      onCopyLink: handleCopyLink,
      onDetails: setDetails,
    },
  });

  const rows = table.getRowModel().rows;
  const noMatches = query !== "" && rows.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            placeholder="Filter by name"
            aria-label="Filter by name"
            className="h-8 pl-8"
          />
        </div>
        {query ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {rows.length} match{rows.length === 1 ? "" : "es"}
          </span>
        ) : null}
      </div>

      {noMatches ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <SearchX className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Nothing in this folder matches “{query}”.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setGlobalFilter("")}
          >
            Clear filter
          </Button>
        </div>
      ) : view === "grid" ? (
        <FileGrid
          sourceId={sourceId}
          folders={rows
            .map((row) => row.original)
            .filter((entry) => entry.kind === "folder")}
          files={rows
            .map((row) => row.original)
            .filter((entry) => entry.kind === "file")}
          onPreview={setPreview}
        />
      ) : (
        <FileTable table={table} />
      )}

      <PreviewDialog
        sourceId={sourceId}
        file={preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        onCopyLink={handleCopyLink}
      />
      <DetailsDialog
        sourceId={sourceId}
        file={details}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
      />
    </div>
  );
}
