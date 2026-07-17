"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { browserQueries } from "@/features/browser/api/queries";
import { usePendingAction } from "@/features/browser/hooks/use-pending-action";
import type { EntryTarget } from "@/features/browser/lib/move";

/**
 * Shared wiring for the destination-picker dialogs (Copy to…, Move to…): the
 * writable-sources query, the destination source/prefix state reset each time
 * the dialog opens, the pending flag, and the resolved destination source.
 * The dialogs layer their own action, i18n strings and any extra guards on top.
 */
export function useDestinationPicker({
  targets,
  defaultSourceId = "",
}: {
  /** Selection to act on — the dialog is open while non-null. */
  targets: EntryTarget[] | null;
  /** Source preselected each time the dialog opens (default: none). */
  defaultSourceId?: string;
}) {
  const open = targets !== null;
  const [destSourceId, setDestSourceId] = useState("");
  const [destPrefix, setDestPrefix] = useState("");
  const { pending, track } = usePendingAction();

  // Fresh start each time the dialog opens.
  useEffect(() => {
    if (open) {
      setDestSourceId(defaultSourceId);
      setDestPrefix("");
    }
  }, [open, defaultSourceId]);

  const sources = useQuery({
    ...browserQueries.writableSources(),
    enabled: open,
  });
  const dest = sources.data?.find((source) => source.id === destSourceId);
  const count = targets?.length ?? 0;

  /** Pick a destination source, resetting the walked prefix. */
  const selectDestSource = (value: string) => {
    setDestSourceId(value);
    setDestPrefix("");
  };

  return {
    open,
    destSourceId,
    destPrefix,
    setDestPrefix,
    selectDestSource,
    sources,
    dest,
    count,
    pending,
    track,
  };
}
