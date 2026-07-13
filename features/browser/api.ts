// Client-side access to the browser feature's read endpoints
// (app/source/[id]/{share,text,details,preview}). Reads never go through
// server actions: on-demand dialog data comes from these GET routes, consumed
// through TanStack Query. Fetchers throw on failure (with the route's error
// message) so query error states carry the message to render.

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

/** URL used directly as the `src` of preview media elements — the route
 *  redirects to a short-lived inline presigned URL, no fetch needed. */
export function previewSrc(sourceId: string, key: string): string {
  return `/source/${sourceId}/preview?key=${encodeURIComponent(key)}`;
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
    `/source/${sourceId}/share?key=${encodeURIComponent(key)}`,
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
    `/source/${sourceId}/text?key=${encodeURIComponent(key)}`,
    "Could not load a preview for this file.",
  );
  return { text: result.text ?? "", truncated: result.truncated };
}

export async function fetchFileDetails(
  sourceId: string,
  key: string,
): Promise<FileDetails> {
  const result = await getJson<FileDetailsResult>(
    `/source/${sourceId}/details?key=${encodeURIComponent(key)}`,
    "Could not load the details for this file.",
  );
  if (!result.details) {
    throw new Error("Could not load the details for this file.");
  }
  return result.details;
}
