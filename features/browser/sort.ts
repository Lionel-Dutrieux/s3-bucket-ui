// Pure client-side sort helpers — no I/O, unit-tested in sort.test.ts.
// Sorting only rearranges the page already loaded; S3 listings have no
// server-side ordering beyond lexicographic keys.

import type { FileEntry, FolderEntry } from "@/features/browser/listing";

export type SortKey = "name" | "size" | "modified";

export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

/** Header click cycle: unsorted → ascending → descending → unsorted. */
export function nextSort(
  current: SortState | null,
  key: SortKey,
): SortState | null {
  if (current?.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return null;
}

/** Folders have no size or date — they only reorder on the name column. */
export function sortFolders(
  folders: FolderEntry[],
  sort: SortState | null,
): FolderEntry[] {
  if (sort?.key !== "name") return folders;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...folders].sort((a, b) => a.name.localeCompare(b.name) * dir);
}

export function sortFiles(
  files: FileEntry[],
  sort: SortState | null,
): FileEntry[] {
  if (!sort) return files;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...files].sort((a, b) => compareFiles(a, b, sort.key) * dir);
}

function compareFiles(a: FileEntry, b: FileEntry, key: SortKey): number {
  if (key === "size") return a.size - b.size;
  if (key === "modified") return (a.lastModified ?? 0) - (b.lastModified ?? 0);
  return a.name.localeCompare(b.name);
}

export function matchesQuery(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.trim().toLowerCase());
}
