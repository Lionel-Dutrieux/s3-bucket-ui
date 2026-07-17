"use client";

import type { Row } from "@tanstack/react-table";
import { downloadUrl, zipSelectionUrl } from "@/features/browser/api/client";
import { submitZipDownload } from "@/features/browser/components/zip-download";
import type { BrowserEntry } from "@/features/browser/lib/entries";

/**
 * Bulk download for the current selection. A single file downloads through its
 * plain link (presigned when the provider supports it); anything more —
 * several files, any folder — streams as one ZIP of the selection.
 */
export function useBulkDownload(
  sourceId: string,
  prefix: string,
  selectedRows: Row<BrowserEntry>[],
) {
  return () => {
    const selectedFiles = selectedRows
      .map((row) => row.original)
      .filter((entry) => entry.kind === "file");
    const selectedFolders = selectedRows
      .map((row) => row.original)
      .filter((entry) => entry.kind === "folder");
    if (selectedFiles.length === 1 && selectedFolders.length === 0) {
      const anchor = document.createElement("a");
      anchor.href = downloadUrl(sourceId, selectedFiles[0].key);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return;
    }
    submitZipDownload(zipSelectionUrl(sourceId), {
      base: prefix,
      keys: selectedFiles.map((file) => file.key),
      prefixes: selectedFolders.map((folder) => folder.prefix),
    });
  };
}
