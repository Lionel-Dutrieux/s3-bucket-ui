// Pure selection arithmetic for the browser's multi-select — kept out of the
// component so the shift-range rules are unit-testable.

export interface ToggleResult {
  selection: Record<string, boolean>;
  /** The row a future shift-click ranges from. */
  anchor: string;
}

/**
 * One click on a row's checkbox. A shift-click selects the whole range
 * between the anchor (last toggled row) and the clicked row, following the
 * DISPLAYED order — it only ever adds to the selection. A plain click
 * toggles the row. Either way the clicked row becomes the next anchor.
 */
export function applyToggle(
  prev: Record<string, boolean>,
  displayedIds: string[],
  id: string,
  shift: boolean,
  anchor: string | null,
): ToggleResult {
  const next = { ...prev };
  if (shift && anchor && anchor !== id) {
    const from = displayedIds.indexOf(anchor);
    const to = displayedIds.indexOf(id);
    if (from !== -1 && to !== -1) {
      for (const rangeId of displayedIds.slice(
        Math.min(from, to),
        Math.max(from, to) + 1,
      )) {
        next[rangeId] = true;
      }
      return { selection: next, anchor: id };
    }
  }
  if (next[id]) {
    delete next[id];
  } else {
    next[id] = true;
  }
  return { selection: next, anchor: id };
}
