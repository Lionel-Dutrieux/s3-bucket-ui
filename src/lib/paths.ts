/**
 * Parent of an object-storage prefix: `"docs/2024/" → "docs/"`,
 * `"docs/" → ""` (bucket root), `"" → null` (already at the root).
 */
export function parentPrefix(prefix: string): string | null {
  const segments = prefix.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  return segments.length === 1 ? "" : `${segments.slice(0, -1).join("/")}/`;
}

/** Fallback name when a guest's filename sanitizes down to nothing usable. */
const SAFE_FILENAME_FALLBACK = "file";

/**
 * Turns an untrusted, guest-supplied filename into a single safe path segment.
 * A drop-link visitor never chooses the destination folder, so any directory
 * component is stripped (`"../../etc/passwd"` → `"passwd"`), and control
 * characters — which could poison an object key or a Content-Disposition
 * header — are removed. `"."`, `".."` and an empty result collapse to a
 * fallback. The return value never contains `/` or `\`, never starts a
 * traversal, and is safe to append to a prefix as `prefix + name`.
 */
export function sanitizeUploadFilename(raw: string): string {
  // Keep only the last path segment — this alone defeats traversal and any
  // attempt to smuggle a nested path.
  const base = raw.split(/[/\\]/).pop() ?? "";
  // Drop C0/DEL control characters (0x00–0x1F, 0x7F) without a control-char
  // regex (which the linter forbids) by filtering code points.
  const cleaned = Array.from(base)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code > 0x1f && code !== 0x7f;
    })
    .join("")
    .trim();
  if (cleaned === "" || cleaned === "." || cleaned === "..") {
    return SAFE_FILENAME_FALLBACK;
  }
  return cleaned;
}

/**
 * Candidate filename for the nth collision: attempt 0 is the name itself, then
 * `"name (1)"`, `"name (2)"`… The suffix lands before the extension so
 * `"report.pdf"` → `"report (1).pdf"`; extensionless names (and dotfiles,
 * whose leading dot is not an extension separator) get it appended. A caller
 * loops, probing the store with each candidate, so a deposit never overwrites
 * an existing object.
 */
export function collisionFreeName(name: string, attempt: number): string {
  if (attempt === 0) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  return `${stem} (${attempt})${ext}`;
}
