// Client-side access to the browser feature's endpoints
// (app/api/sources/[id]/…). Reads never go through server actions: on-demand
// dialog data comes from these GET routes, consumed through TanStack Query.
// Fetchers throw on failure (with the route's error message) so query error
// states carry the message to render. URL builders for routes consumed
// directly by the browser (src/href attributes, XHR upload) live here too so
// endpoint paths have a single home.

export interface UrlResult {
  url?: string;
  error?: string;
}

export interface TextPreview {
  text: string;
  /** True when the file is larger than the preview window (first 1 MiB). */
  truncated?: boolean;
}

export type TextPreviewResult = Partial<TextPreview> & { error?: string };

export interface FileDetails {
  key: string;
  size: number;
  contentType?: string;
  etag?: string;
  lastModified?: number;
  /** User metadata stored on the object, when the provider returns it. */
  metadata?: Record<string, string>;
}

export interface FileDetailsResult {
  details?: FileDetails;
  error?: string;
}

export interface SearchHit {
  key: string;
  size: number;
  lastModified?: number;
}

export interface SearchResults {
  hits: SearchHit[];
  /** True when the walk stopped early (result cap or time budget). */
  truncated?: boolean;
}

export type SearchResultsResponse = Partial<SearchResults> & {
  error?: string;
};

/** URL used directly as the `src` of preview media elements — the route
 *  redirects to a short-lived inline presigned URL, no fetch needed. */
export function previewSrc(sourceId: string, key: string): string {
  return `/api/sources/${sourceId}/preview?key=${encodeURIComponent(key)}`;
}

/** URL used as the `src` of grid thumbnails (redirects to an inline
 *  presigned URL, lazy-loaded by the browser). */
export function thumbnailSrc(sourceId: string, key: string): string {
  return `/api/sources/${sourceId}/thumbnail?key=${encodeURIComponent(key)}`;
}

/** URL used as a download `href` (redirects to an attachment presigned URL). */
export function downloadUrl(sourceId: string, key: string): string {
  return `/api/sources/${sourceId}/download?key=${encodeURIComponent(key)}`;
}

/** URL used as a folder-download `href` (streams the folder as one ZIP). */
export function zipUrl(sourceId: string, prefix: string): string {
  return `/api/sources/${sourceId}/zip?prefix=${encodeURIComponent(prefix)}`;
}

/** Endpoint the XHR uploader POSTs one file body to. */
export function uploadUrl(sourceId: string, key: string): string {
  return `/api/sources/${sourceId}/upload?key=${encodeURIComponent(key)}`;
}

// Error routes still respond with JSON ({ error }); anything else (network
// failure, proxy error page) falls back to the caller's message.
export async function getJson<T extends { error?: string }>(
  url: string,
  fallback: string,
): Promise<T> {
  let body: T | null = null;
  try {
    const response = await fetch(url);
    body = (await response.json()) as T;
  } catch {
    throw new Error(fallback);
  }
  if (body?.error) throw new Error(body.error);
  return body;
}

export async function fetchShareUrl(
  sourceId: string,
  key: string,
): Promise<string> {
  const result = await getJson<UrlResult>(
    `/api/sources/${sourceId}/share?key=${encodeURIComponent(key)}`,
    "Could not create a link for this file.",
  );
  if (!result.url) throw new Error("Could not create a link for this file.");
  return result.url;
}

export async function fetchTextPreview(
  sourceId: string,
  key: string,
): Promise<TextPreview> {
  const result = await getJson<TextPreviewResult>(
    `/api/sources/${sourceId}/text?key=${encodeURIComponent(key)}`,
    "Could not load a preview for this file.",
  );
  return { text: result.text ?? "", truncated: result.truncated };
}

export async function fetchSearchResults(
  sourceId: string,
  q: string,
): Promise<SearchResults> {
  const result = await getJson<SearchResultsResponse>(
    `/api/sources/${sourceId}/search?q=${encodeURIComponent(q)}`,
    "Search failed — try again.",
  );
  return { hits: result.hits ?? [], truncated: result.truncated };
}

export async function fetchFileDetails(
  sourceId: string,
  key: string,
): Promise<FileDetails> {
  const result = await getJson<FileDetailsResult>(
    `/api/sources/${sourceId}/details?key=${encodeURIComponent(key)}`,
    "Could not load the details for this file.",
  );
  if (!result.details) {
    throw new Error("Could not load the details for this file.");
  }
  return result.details;
}
