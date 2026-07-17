"use client";

import type { Row } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { BrowserEntry } from "@/features/browser/lib/entries";
import type { FileEntry } from "@/features/browser/lib/listing";
import { isPreviewable } from "@/features/browser/lib/preview-kind";

/**
 * Keyboard verbs on the current selection: Enter opens (folder → navigate,
 * previewable file → preview, otherwise details), F2 renames, Delete deletes.
 * Skipped while typing or while a dialog/sheet overlay is up. The effect has no
 * dependency array on purpose — re-subscribing every render keeps the handler's
 * closure fresh.
 */
export function useBrowserShortcuts({
  sourceId,
  selectedRows,
  canRename,
  canDelete,
  onPreview,
  onDetails,
  onRename,
  onBulkDelete,
}: {
  sourceId: string;
  selectedRows: Row<BrowserEntry>[];
  canRename: boolean;
  canDelete: boolean;
  onPreview: (file: FileEntry) => void;
  onDetails: (file: FileEntry) => void;
  onRename: (entry: BrowserEntry) => void;
  onBulkDelete: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable ||
        target?.closest(
          '[data-slot="dialog-content"], [data-slot="sheet-content"]',
        )
      ) {
        return;
      }
      if (selectedRows.length === 0) return;
      const single =
        selectedRows.length === 1 ? selectedRows[0].original : null;

      if (event.key === "Enter" && single) {
        event.preventDefault();
        if (single.kind === "folder") {
          router.push(
            `/source/${sourceId}?prefix=${encodeURIComponent(single.prefix)}`,
          );
        } else if (isPreviewable(single.name)) {
          onPreview(single);
        } else {
          onDetails(single);
        }
      } else if (event.key === "F2" && single && canRename) {
        event.preventDefault();
        onRename(single);
      } else if (event.key === "Delete" && canDelete) {
        event.preventDefault();
        onBulkDelete();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
}
