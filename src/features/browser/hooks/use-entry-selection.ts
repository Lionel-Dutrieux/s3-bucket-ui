"use client";

import type { RowSelectionState } from "@tanstack/react-table";
import { useCallback, useRef, useState } from "react";
import { applyToggle } from "@/features/browser/lib/selection";

/**
 * Multi-select state for the browser rows: plain toggle, shift-click range
 * (following the displayed order) and clear. The displayed order comes from
 * the table's row model, which itself consumes this hook's state — the
 * component breaks that cycle by calling `bindDisplayedIds` once the rows
 * exist; toggles only fire on events, after render.
 */
export function useEntrySelection() {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const anchor = useRef<string | null>(null);
  const displayedIds = useRef<string[]>([]);

  const bindDisplayedIds = useCallback((ids: string[]) => {
    displayedIds.current = ids;
  }, []);

  const toggleSelect = useCallback((id: string, shift: boolean) => {
    setRowSelection((prev) => {
      const result = applyToggle(
        prev,
        displayedIds.current,
        id,
        shift,
        anchor.current,
      );
      anchor.current = result.anchor;
      return result.selection;
    });
  }, []);

  const clear = useCallback(() => setRowSelection({}), []);

  return {
    rowSelection,
    setRowSelection,
    bindDisplayedIds,
    toggleSelect,
    clear,
  };
}
