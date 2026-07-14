"use client";

import { Copy, Download, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Toolbar shown while a selection is active: count, select-all toggle and
 *  the bulk actions (download and copy-to always, delete only when
 *  permitted — the destination's edit grant is checked server-side). */
export function SelectionToolbar({
  selectedCount,
  allVisibleSelected,
  onClear,
  onToggleSelectAll,
  onBulkDownload,
  bulkDownloadDisabled,
  onCopyTo,
  canDelete,
  onBulkDelete,
}: {
  selectedCount: number;
  allVisibleSelected: boolean;
  onClear: () => void;
  onToggleSelectAll: () => void;
  onBulkDownload: () => void;
  bulkDownloadDisabled: boolean;
  onCopyTo: () => void;
  canDelete: boolean;
  onBulkDelete: () => void;
}) {
  return (
    <div className="flex h-8 items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onClear}
        aria-label="Clear selection"
      >
        <X className="size-4" aria-hidden />
      </Button>
      <span className="text-sm font-medium tabular-nums">
        {selectedCount} selected
      </span>
      <button
        type="button"
        onClick={onToggleSelectAll}
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {allVisibleSelected ? "Deselect all" : "Select all"}
      </button>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={onBulkDownload}
          disabled={bulkDownloadDisabled}
        >
          <Download aria-hidden />
          Download
        </Button>
        <Button variant="outline" size="sm" className="h-8" onClick={onCopyTo}>
          <Copy aria-hidden />
          Copy to…
        </Button>
        {canDelete ? (
          <Button
            variant="destructive"
            size="sm"
            className="h-8"
            onClick={onBulkDelete}
          >
            <Trash2 aria-hidden />
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  );
}
