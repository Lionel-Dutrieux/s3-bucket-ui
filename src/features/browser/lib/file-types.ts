// File categorization by extension — single source of truth for icons
// (file-icon.tsx) and the type filter (?type= search param). Display labels
// live in messages/*.json under browser.fileTypes, keyed by id — this module
// is pure and exposes ids only, translation resolves at the render site.
export const FILE_CATEGORIES = [
  { id: "image" },
  { id: "video" },
  { id: "audio" },
  { id: "document" },
  { id: "pdf" },
  { id: "spreadsheet" },
  { id: "code" },
  { id: "archive" },
] as const;

export type FileCategory = (typeof FILE_CATEGORIES)[number]["id"];

export const EXTENSION_CATEGORIES: Record<string, FileCategory> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  avif: "image",
  ico: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
  avi: "video",
  mp3: "audio",
  wav: "audio",
  flac: "audio",
  ogg: "audio",
  m4a: "audio",
  zip: "archive",
  tar: "archive",
  gz: "archive",
  rar: "archive",
  "7z": "archive",
  bz2: "archive",
  zst: "archive",
  js: "code",
  ts: "code",
  tsx: "code",
  jsx: "code",
  json: "code",
  html: "code",
  css: "code",
  py: "code",
  go: "code",
  rs: "code",
  sh: "code",
  ps1: "code",
  yml: "code",
  yaml: "code",
  sql: "code",
  toml: "code",
  csv: "spreadsheet",
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  pdf: "pdf",
  txt: "document",
  md: "document",
  doc: "document",
  docx: "document",
  rtf: "document",
  log: "document",
};

export function categoryOf(name: string): FileCategory | undefined {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_CATEGORIES[extension];
}

// Plain-text extensions outside the "code" category. doc/docx/rtf (document)
// and xls/xlsx (spreadsheet) are binary formats — not text-previewable.
const TEXT_DOCUMENT_EXTENSIONS = new Set(["txt", "md", "log", "csv"]);

/** Whether the file's content can be rendered as plain text in the preview. */
export function isTextFile(name: string): boolean {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return (
    EXTENSION_CATEGORIES[extension] === "code" ||
    TEXT_DOCUMENT_EXTENSIONS.has(extension)
  );
}
