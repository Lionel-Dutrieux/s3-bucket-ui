import { queryOptions } from "@tanstack/react-query";
import {
  fetchFileDetails,
  fetchShareUrl,
  fetchTextPreview,
} from "@/features/browser/api/client";

/**
 * queryOptions factory for the browser feature — the single home for its
 * query keys, so a cache entry can never drift apart from its fetcher.
 * `all(sourceId)` prefixes every key, giving one handle to invalidate
 * everything cached for a source.
 */
export const browserQueries = {
  all: (sourceId: string) => ["browser", sourceId] as const,
  fileDetails: (sourceId: string, key: string) =>
    queryOptions({
      queryKey: [...browserQueries.all(sourceId), "details", key],
      queryFn: () => fetchFileDetails(sourceId, key),
    }),
  textPreview: (sourceId: string, key: string) =>
    queryOptions({
      queryKey: [...browserQueries.all(sourceId), "text", key],
      queryFn: () => fetchTextPreview(sourceId, key),
    }),
  /** Fetched imperatively (fetchQuery) on copy-link: the default staleTime
   *  of 0 dedupes rapid double-clicks yet mints a fresh link on each later
   *  copy. */
  shareUrl: (sourceId: string, key: string) =>
    queryOptions({
      queryKey: [...browserQueries.all(sourceId), "share", key],
      queryFn: () => fetchShareUrl(sourceId, key),
    }),
};
