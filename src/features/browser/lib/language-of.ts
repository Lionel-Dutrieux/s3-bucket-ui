// Extension → shiki language id, for the code viewer. Mirrors the "code"
// extensions in file-types.ts (plus md/csv relatives that reach the code
// path via toggles). Unknown → "text" (shiki renders it un-highlighted).

const LANGUAGES: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  json: "json",
  html: "html",
  css: "css",
  py: "python",
  go: "go",
  rs: "rust",
  sh: "shellscript",
  ps1: "powershell",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  toml: "toml",
  md: "markdown",
  markdown: "markdown",
};

export function languageOf(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGES[extension] ?? "text";
}
