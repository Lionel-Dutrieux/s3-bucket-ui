import type { SortingState } from "@tanstack/react-table";
import { createParser } from "nuqs";

// URL codec for the table's sorting state (?sort=name, ?sort=size:desc, …).
// Single-column only, mirroring enableMultiSort: false on the table.

const SORTABLE_COLUMNS = ["name", "size", "modified"] as const;
type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export function parseSortParam(value: string): SortingState | null {
  const [id, direction, ...rest] = value.split(":");
  if (!SORTABLE_COLUMNS.includes(id as SortableColumn)) return null;
  if (rest.length > 0 || (direction !== undefined && direction !== "desc")) {
    return null;
  }
  return [{ id, desc: direction === "desc" }];
}

export function serializeSortParam(sorting: SortingState): string {
  const first = sorting[0];
  if (!first) return "";
  return first.desc ? `${first.id}:desc` : first.id;
}

export const sortParser = createParser<SortingState>({
  parse: parseSortParam,
  serialize: serializeSortParam,
  eq: (a, b) => serializeSortParam(a) === serializeSortParam(b),
});
