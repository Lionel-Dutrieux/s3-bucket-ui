// Pure scoping logic for a share link: whether it targets one object or a whole
// prefix, and — for prefix shares — the security boundary that keeps a public
// visitor inside the shared folder. No I/O so Vitest can import it directly.
//
// A prefix share exposes every object under `share.key` (which ends with "/").
// The public routes take an untrusted object key or sub-prefix from the query
// string; these helpers are the single guard that a requested path genuinely
// sits under the share prefix and never escapes it.

/** True when a share exposes a whole folder prefix rather than a single file. */
export function isPrefixShare(kind: string): boolean {
  return kind === "prefix";
}

/** A key that could hide a traversal or NUL-byte trick — rejected outright. */
function isUnsafePath(value: string): boolean {
  if (value.includes("\0")) return true;
  // Object keys are literal, never resolved as filesystem paths, but a "." or
  // ".." segment is never a legitimate S3 key component and only ever shows up
  // in an escape attempt — refuse it.
  return value
    .split("/")
    .some((segment) => segment === "." || segment === "..");
}

/**
 * Validates an object key a visitor asks to preview/download from a prefix
 * share. Returns the key unchanged when it genuinely sits under `prefix`, else
 * null (the caller answers 404). The trailing slash on `prefix` makes
 * `startsWith` a real boundary: "photos/" admits "photos/a.jpg" but never
 * "photos-secret/a.jpg". Rejects the bare prefix, any folder key (trailing
 * slash) and traversal/NUL tricks.
 */
export function resolveObjectWithinPrefix(
  prefix: string,
  requested: string,
): string | null {
  if (!prefix.endsWith("/")) return null;
  if (!requested || requested.endsWith("/")) return null;
  if (isUnsafePath(requested)) return null;
  if (!requested.startsWith(prefix)) return null;
  // Something must remain past the prefix — an object, not the folder itself.
  if (requested.length <= prefix.length) return null;
  return requested;
}

/**
 * Validates a sub-prefix a visitor navigates into within a prefix share. The
 * public viewer carries the full prefix in `?p=`. Returns the normalized
 * prefix (always ending in "/") when it is the share prefix itself or sits
 * under it, else null. An empty request means "the root of the share".
 */
export function resolveSubPrefix(
  prefix: string,
  requested: string,
): string | null {
  if (!prefix.endsWith("/")) return null;
  if (requested === "") return prefix;
  const full = requested.endsWith("/") ? requested : `${requested}/`;
  if (isUnsafePath(full)) return null;
  if (full !== prefix && !full.startsWith(prefix)) return null;
  return full;
}
