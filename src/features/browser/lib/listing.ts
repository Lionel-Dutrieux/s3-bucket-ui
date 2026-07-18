// Pure listing helpers — no I/O, unit-tested in listing.test.ts.

import { KEEP_FILE_NAME } from "@/lib/storage/providers";

export interface FolderEntry {
  /** Full prefix including trailing slash, e.g. "photos/2024/" */
  prefix: string;
  name: string;
}

export interface FileEntry {
  key: string;
  name: string;
  size: number;
  lastModified?: number;
}

export interface RawListResult {
  items: { key: string; size: number; lastModified?: number }[];
  prefixes?: string[];
  cursor?: string;
}

export interface FolderListing {
  folders: FolderEntry[];
  files: FileEntry[];
  nextCursor?: string;
}

/**
 * Turns a raw S3-style delimiter listing into folders + files relative to
 * `prefix`, skipping the zero-byte "folder marker" objects some dashboards
 * (e.g. Cloudflare R2) create. With `hideKeepMarkers`, also hides the
 * `.keep` files that materialize empty folders on filesystem-backed sources
 * (see usesKeepFileMarkers in lib/storage/providers.ts).
 */
export function partitionListing(
  result: RawListResult,
  prefix: string,
  opts?: { hideKeepMarkers?: boolean },
): FolderListing {
  const folders = (result.prefixes ?? [])
    .filter((folderPrefix) => folderPrefix !== prefix)
    .map((folderPrefix) => ({
      prefix: folderPrefix,
      name: folderPrefix.slice(prefix.length).replace(/\/$/, ""),
    }));

  const files = result.items
    .filter((item) => item.key !== prefix && !item.key.endsWith("/"))
    .filter(
      (item) =>
        !(
          opts?.hideKeepMarkers &&
          item.key.slice(prefix.length) === KEEP_FILE_NAME
        ),
    )
    .map((item) => ({
      key: item.key,
      name: item.key.slice(prefix.length),
      size: item.size,
      lastModified: item.lastModified,
    }));

  return { folders, files, nextCursor: result.cursor };
}

export interface Crumb {
  label: string;
  /** Prefix to navigate to, including trailing slash. */
  prefix: string;
}

/** "docs/2024/" → [{label: "docs", prefix: "docs/"}, {label: "2024", prefix: "docs/2024/"}] */
export function buildCrumbs(prefix: string): Crumb[] {
  const segments = prefix.split("/").filter(Boolean);
  return segments.map((segment, index) => ({
    label: segment,
    prefix: `${segments.slice(0, index + 1).join("/")}/`,
  }));
}
