import { queryOptions } from "@tanstack/react-query";
import { fetchSourceHealth } from "@/features/sources/api/client";

/**
 * queryOptions factory for the sources feature — the single home for its query
 * keys, so a cache entry can never drift apart from its fetcher.
 */
export const sourcesQueries = {
  /** Health of every readable source, keyed by id. Polled once a minute
   *  (matching the server-side TTL); no aggressive refetch on focus — this is
   *  ambient status, not a user-triggered read. */
  health: () =>
    queryOptions({
      queryKey: ["sources", "health"] as const,
      queryFn: fetchSourceHealth,
      staleTime: 60_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    }),
};
