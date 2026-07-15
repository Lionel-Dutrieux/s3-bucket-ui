import { queryOptions } from "@tanstack/react-query";
import {
  fetchFileDetails,
  fetchFolders,
  fetchSearchResults,
  fetchTextPreview,
  fetchWritableSources,
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
  /** Source-wide key search — cached briefly so reopening the dialog with
   *  the same query doesn't re-walk the bucket. */
  search: (sourceId: string, q: string) =>
    queryOptions({
      queryKey: [...browserQueries.all(sourceId), "search", q],
      queryFn: () => fetchSearchResults(sourceId, q),
      staleTime: 30_000,
    }),
  /** Destinations for the cross-source copy dialog. */
  writableSources: () =>
    queryOptions({
      queryKey: ["sources", "writable"] as const,
      queryFn: fetchWritableSources,
      staleTime: 60_000,
    }),
  /** One folder level of a source — drives the destination folder picker. */
  folders: (sourceId: string, prefix: string) =>
    queryOptions({
      queryKey: [...browserQueries.all(sourceId), "folders", prefix],
      queryFn: () => fetchFolders(sourceId, prefix),
      staleTime: 30_000,
    }),
};
