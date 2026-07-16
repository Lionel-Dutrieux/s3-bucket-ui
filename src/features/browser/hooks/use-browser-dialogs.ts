"use client";

import { useCallback, useState } from "react";
import type { MoveRequest } from "@/features/browser/components/move-dialog";
import type { BrowserEntry } from "@/features/browser/lib/entries";
import type { FileEntry } from "@/features/browser/lib/listing";
import type { EntryTarget } from "@/features/browser/lib/move";

/** The browser's overlays are mutually exclusive — one union instead of one
 * open-state per dialog. The details panel and the inline rename are not in
 * here: they coexist with these dialogs. */
export type BrowserDialog =
  | { kind: "share"; file: FileEntry }
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
      (file: FileEntry) => setDialog({ kind: "share", file }),
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
