"use client";

import { useCallback, useState } from "react";

/**
 * The pending flag every mutation dialog needs: `track` wraps the async work
 * and guarantees the flag drops even when the action throws.
 */
export function usePendingAction() {
  const [pending, setPending] = useState(false);

  const track = useCallback(async <T>(work: () => Promise<T>): Promise<T> => {
    setPending(true);
    try {
      return await work();
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, track };
}
