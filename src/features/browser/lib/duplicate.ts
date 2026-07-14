/**
 * Candidate key for the nth duplicate of an object: "docs/report.pdf" →
 * "docs/report (copy).pdf", then "docs/report (copy 2).pdf", … The suffix
 * lands before the extension; extensionless names (and dotfiles, whose
 * leading dot is not an extension separator) get it appended.
 */
export function duplicateKeyCandidate(key: string, attempt: number): string {
  const slash = key.lastIndexOf("/");
  const dir = key.slice(0, slash + 1);
  const base = key.slice(slash + 1);

  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";

  const suffix = attempt === 1 ? " (copy)" : ` (copy ${attempt})`;
  return `${dir}${stem}${suffix}${ext}`;
}
