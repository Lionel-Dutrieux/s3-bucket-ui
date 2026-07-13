"use client";

export interface DroppedFile {
  file: File;
  /** Path relative to the drop target — "report.pdf" or "photos/a.jpg". */
  path: string;
}

/**
 * Collects every file in a drop, descending into dropped folders. The
 * FileSystemEntry handles must be grabbed synchronously — the DataTransfer
 * is neutered once the drop handler yields — so this reads `items` before
 * its first await. Browsers without webkitGetAsEntry fall back to the flat
 * file list (no folder support).
 */
export async function filesFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<DroppedFile[]> {
  const entries = Array.from(dataTransfer.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry) => entry !== null && entry !== undefined);

  if (entries.length === 0) {
    return Array.from(dataTransfer.files).map((file) => ({
      file,
      path: file.name,
    }));
  }

  const collected: DroppedFile[] = [];
  for (const entry of entries) {
    await walk(entry, "", collected);
  }
  return collected;
}

async function walk(
  entry: FileSystemEntry,
  base: string,
  out: DroppedFile[],
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    out.push({ file, path: base + file.name });
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries returns batches (100 max in Chromium) — drain until empty.
    let batch: FileSystemEntry[];
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      for (const child of batch) {
        await walk(child, `${base}${entry.name}/`, out);
      }
    } while (batch.length > 0);
  }
}
