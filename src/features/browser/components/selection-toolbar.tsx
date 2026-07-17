"use client";

import { Copy, Download, FolderInput, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Toolbar shown while a selection is active: count, select-all toggle and
 *  the bulk actions (download and copy-to always, move and delete only when
 *  permitted — the destination's edit grant is checked server-side). */
export function SelectionToolbar({
  selectedCount,
  allVisibleSelected,
  onClear,
  onToggleSelectAll,
  onBulkDownload,
  bulkDownloadDisabled,
  onCopyTo,
  canMove,
  onMoveTo,
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
  canMove: boolean;
  onMoveTo: () => void;
  canDelete: boolean;
  onBulkDelete: () => void;
}) {
  const t = useTranslations("browser.selectionToolbar");
  return (
    <div className="flex h-8 items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onClear}
        aria-label={t("clearSelection")}
      >
        <X className="size-4" aria-hidden />
      </Button>
      <span className="text-sm font-medium tabular-nums">
        {t("selectedCount", { count: selectedCount })}
      </span>
      <button
        type="button"
        onClick={onToggleSelectAll}
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {allVisibleSelected ? t("deselectAll") : t("selectAll")}
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
          {t("download")}
        </Button>
        <Button variant="outline" size="sm" className="h-8" onClick={onCopyTo}>
          <Copy aria-hidden />
          {t("copyTo")}
        </Button>
        {canMove ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onMoveTo}
          >
            <FolderInput aria-hidden />
            {t("moveTo")}
          </Button>
        ) : null}
        {canDelete ? (
          <Button
            variant="destructive"
            size="sm"
            className="h-8"
            onClick={onBulkDelete}
          >
            <Trash2 aria-hidden />
            {t("delete")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
