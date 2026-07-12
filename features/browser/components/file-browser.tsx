"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { toast } from "sonner";
import { getShareUrl } from "@/features/browser/actions";
import { FileGrid } from "@/features/browser/components/file-grid";
import { FileTable } from "@/features/browser/components/file-table";
import { PreviewDialog } from "@/features/browser/components/preview-dialog";
import type { FileEntry, FolderEntry } from "@/features/browser/listing";
import {
  matchesQuery,
  nextSort,
  sortFiles,
  sortFolders,
  type SortKey,
  type SortState,
} from "@/features/browser/sort";
import type { ViewMode } from "@/features/browser/view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Client shell around the listing: filters and sorts the entries the server
 * already loaded (this page only), and owns the preview dialog.
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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);
  const [preview, setPreview] = useState<FileEntry | null>(null);

  const visibleFolders = useMemo(
    () =>
      sortFolders(
        query ? folders.filter((f) => matchesQuery(f.name, query)) : folders,
        sort
      ),
    [folders, query, sort]
  );
  const visibleFiles = useMemo(
    () =>
      sortFiles(
        query ? files.filter((f) => matchesQuery(f.name, query)) : files,
        sort
      ),
    [files, query, sort]
  );

  const handleSort = (key: SortKey) => setSort((current) => nextSort(current, key));

  const handleCopyLink = async (file: FileEntry) => {
    const result = await getShareUrl(sourceId, file.key);
    if (!result.url) {
      toast.error(result.error ?? "Could not create a link.");
      return;
    }
    await navigator.clipboard.writeText(result.url);
    toast.success("Link copied — valid for 1 hour");
  };

  const handlePreview = (file: FileEntry) => setPreview(file);

  const noMatches =
    query !== "" && visibleFolders.length === 0 && visibleFiles.length === 0;

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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name"
            aria-label="Filter by name"
            className="h-8 pl-8"
          />
        </div>
        {query ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {visibleFolders.length + visibleFiles.length} match
            {visibleFolders.length + visibleFiles.length === 1 ? "" : "es"}
          </span>
        ) : null}
      </div>

      {noMatches ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <SearchX className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Nothing in this folder matches “{query}”.
          </p>
          <Button variant="outline" size="sm" onClick={() => setQuery("")}>
            Clear filter
          </Button>
        </div>
      ) : view === "grid" ? (
        <FileGrid
          sourceId={sourceId}
          folders={visibleFolders}
          files={visibleFiles}
          onPreview={handlePreview}
        />
      ) : (
        <FileTable
          sourceId={sourceId}
          folders={visibleFolders}
          files={visibleFiles}
          sort={sort}
          onSort={handleSort}
          onPreview={handlePreview}
          onCopyLink={handleCopyLink}
        />
      )}

      <PreviewDialog
        sourceId={sourceId}
        file={preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        onCopyLink={handleCopyLink}
      />
    </div>
  );
}
