"use client";

import type { Row, RowSelectionState } from "@tanstack/react-table";
import type { MoveRequest } from "@/features/browser/components/dialogs/move-dialog";
import type { DragData } from "@/features/browser/components/dnd";
import type { DroppedFile } from "@/features/browser/components/drop";
import { useDropUpload } from "@/features/browser/hooks/use-drop-upload";
import { useEntryDrag } from "@/features/browser/hooks/use-entry-drag";
import type { BrowserEntry } from "@/features/browser/lib/entries";
import { type EntryTarget, toTarget } from "@/features/browser/lib/move";

/**
 * The browser surface's drag-and-drop layer, in one place: drop-to-upload
 * wiring (the overlay-backed `dropZoneProps`) plus the drag-to-move plumbing
 * (sensors, overlay state and the drop→MoveRequest handler). `movingTargets`
 * resolves what a drag actually moves — the whole selection when the dragged
 * row is part of it, the single row otherwise.
 */
export function useBrowserDnd({
  canUpload,
  addFiles,
  rowSelection,
  selectedRows,
  onMoveRequest,
}: {
  canUpload: boolean;
  addFiles: (files: DroppedFile[]) => void;
  rowSelection: RowSelectionState;
  selectedRows: Row<BrowserEntry>[];
  onMoveRequest: (request: MoveRequest) => void;
}) {
  const { dragging, dropZoneProps } = useDropUpload(canUpload, addFiles);

  const movingTargets = (dragged: DragData): EntryTarget[] => {
    const selectedIds = new Set(Object.keys(rowSelection));
    if (selectedIds.size > 1 && selectedIds.has(dragged.rowId)) {
      return selectedRows.map((row) => toTarget(row.original));
    }
    return [dragged.target];
  };

  const drag = useEntryDrag({ movingTargets, onMoveRequest });

  return { dragging, dropZoneProps, drag };
}
