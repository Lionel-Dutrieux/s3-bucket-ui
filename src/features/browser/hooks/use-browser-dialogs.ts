"use client";

import { useCallback, useState } from "react";
import type { MoveRequest } from "@/features/browser/components/dialogs/move-dialog";
import type { BrowserEntry } from "@/features/browser/lib/entries";
import type { FileEntry, FolderEntry } from "@/features/browser/lib/listing";
import type { EntryTarget } from "@/features/browser/lib/move";

/** What a share dialog is minting a link for: a single file or a whole folder
 * prefix. `key` is the object key (file) or the prefix ending in "/" (folder). */
export type ShareTarget = {
  kind: "file" | "prefix";
  key: string;
  name: string;
};

/** What a drop-link dialog is minting a deposit link for: a folder prefix (or
 * the bucket root). `prefix` is "" at the root, else ends in "/". */
export type DropTarget = {
  prefix: string;
  name: string;
  isRoot: boolean;
};

/** The browser's overlays are mutually exclusive — one union instead of one
 * open-state per dialog. The details panel and the inline rename are not in
 * here: they coexist with these dialogs. */
export type BrowserDialog =
  | { kind: "share"; target: ShareTarget }
  | { kind: "drop"; target: DropTarget }
  | { kind: "delete"; entry: BrowserEntry }
  | { kind: "bulk-delete" }
  | { kind: "search" }
  | { kind: "move"; request: MoveRequest }
  | { kind: "move-to"; targets: EntryTarget[] }
  | { kind: "copy-to"; targets: EntryTarget[] };

export function useBrowserDialogs() {
  const [dialog, setDialog] = useState<BrowserDialog | null>(null);
  const close = useCallback(() => setDialog(null), []);

  return {
    dialog,
    close,
    openShare: useCallback(
      (file: FileEntry) =>
        setDialog({
          kind: "share",
          target: { kind: "file", key: file.key, name: file.name },
        }),
      [],
    ),
    openShareFolder: useCallback(
      (folder: FolderEntry) =>
        setDialog({
          kind: "share",
          target: { kind: "prefix", key: folder.prefix, name: folder.name },
        }),
      [],
    ),
    openDropFolder: useCallback(
      (folder: FolderEntry) =>
        setDialog({
          kind: "drop",
          target: { prefix: folder.prefix, name: folder.name, isRoot: false },
        }),
      [],
    ),
    openDropHere: useCallback(
      (prefix: string, name: string) =>
        setDialog({
          kind: "drop",
          target: { prefix, name, isRoot: prefix === "" },
        }),
      [],
    ),
    openDelete: useCallback(
      (entry: BrowserEntry) => setDialog({ kind: "delete", entry }),
      [],
    ),
    openBulkDelete: useCallback(() => setDialog({ kind: "bulk-delete" }), []),
    openSearch: useCallback(() => setDialog({ kind: "search" }), []),
    openMove: useCallback(
      (request: MoveRequest) => setDialog({ kind: "move", request }),
      [],
    ),
    openMoveTo: useCallback(
      (targets: EntryTarget[]) => setDialog({ kind: "move-to", targets }),
      [],
    ),
    openCopyTo: useCallback(
      (targets: EntryTarget[]) => setDialog({ kind: "copy-to", targets }),
      [],
    ),
  };
}
