// Single home for the public share endpoint URLs, shared by the viewer's card,
// gallery and preview dialog. For a prefix share the object key is passed
// through ?key= (server-validated to sit under the share prefix); a file share
// omits it and the route uses share.key.

/** Download `href` — omit `key` for a single-file share. */
export function shareDownloadHref(token: string, key?: string): string {
  const base = `/api/s/${token}/download`;
  return key ? `${base}?key=${encodeURIComponent(key)}` : base;
}

/** Inline `src` for previewable media (image/video/audio/pdf). */
export function shareInlineSrc(token: string, key?: string): string {
  const base = `/api/s/${token}/download?inline=1`;
  return key ? `${base}&key=${encodeURIComponent(key)}` : base;
}
