// Client-side access to the public drop-link endpoint. The deposit UI POSTs one
// file body per request (XHR, for upload progress) to this URL; the original
// filename rides in the query string and the server sanitizes it.

/** Endpoint the XHR uploader POSTs one file body to. */
export function dropUploadUrl(token: string, name: string): string {
  return `/api/d/${token}/upload?name=${encodeURIComponent(name)}`;
}
