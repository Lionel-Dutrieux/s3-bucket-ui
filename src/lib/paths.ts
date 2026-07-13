/**
 * Parent of an object-storage prefix: `"docs/2024/" → "docs/"`,
 * `"docs/" → ""` (bucket root), `"" → null` (already at the root).
 */
export function parentPrefix(prefix: string): string | null {
  const segments = prefix.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  return segments.length === 1 ? "" : `${segments.slice(0, -1).join("/")}/`;
}
