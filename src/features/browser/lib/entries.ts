// Pure row model for the browser table — no I/O, unit-tested in
// entries.test.ts. Folders and files share one TanStack Table instance, so
// they are merged into a single discriminated entry type.
//
// Comparators return 0 across kinds (and for folders on file-only columns):
// the sort is stable, and the view re-partitions rows folders-first after
// sorting, so grouping survives both sort directions.

import type { FileEntry, FolderEntry } from "@/features/browser/lib/listing";

export type BrowserEntry =
  | ({ kind: "folder" } & FolderEntry)
  | ({ kind: "file" } & FileEntry);

export function buildEntries(
  folders: FolderEntry[],
  files: FileEntry[],
): BrowserEntry[] {
  return [
    ...folders.map((folder) => ({ kind: "folder" as const, ...folder })),
    ...files.map((file) => ({ kind: "file" as const, ...file })),
  ];
}

export function compareByName(a: BrowserEntry, b: BrowserEntry): number {
  if (a.kind !== b.kind) return 0;
  return a.name.localeCompare(b.name);
}

export function compareBySize(a: BrowserEntry, b: BrowserEntry): number {
  if (a.kind !== "file" || b.kind !== "file") return 0;
  return a.size - b.size;
}

export function compareByModified(a: BrowserEntry, b: BrowserEntry): number {
  if (a.kind !== "file" || b.kind !== "file") return 0;
  return (a.lastModified ?? 0) - (b.lastModified ?? 0);
}

export function entryMatches(entry: BrowserEntry, query: string): boolean {
  return entry.name.toLowerCase().includes(query.trim().toLowerCase());
}
