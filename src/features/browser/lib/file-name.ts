/**
 * Splits a file name into stem and extension at the last dot: "photo.jpg" →
 * { stem: "photo", ext: ".jpg" }. Extensionless names (and dotfiles, whose
 * leading dot is not an extension separator) are all stem. The inline rename
 * edits the stem only and re-appends `ext`, so a rename can never drop the
 * extension.
 */
export function splitFileName(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { stem: name, ext: "" };
  return { stem: name.slice(0, dot), ext: name.slice(dot) };
}
