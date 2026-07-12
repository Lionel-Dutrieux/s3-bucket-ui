import {
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  File as FileIconBase,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Google-Drive-style: each file category gets an icon AND a color.
const CATEGORIES: Record<string, { icon: LucideIcon; className: string }> = {
  image: { icon: FileImage, className: "text-emerald-500" },
  video: { icon: FileVideo, className: "text-rose-500" },
  audio: { icon: FileAudio, className: "text-orange-500" },
  archive: { icon: FileArchive, className: "text-amber-600" },
  code: { icon: FileCode, className: "text-sky-500" },
  spreadsheet: { icon: FileSpreadsheet, className: "text-green-600" },
  pdf: { icon: FileText, className: "text-red-500" },
  document: { icon: FileText, className: "text-blue-500" },
};

const EXTENSIONS: Record<string, keyof typeof CATEGORIES> = {
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
  svg: "image", avif: "image", ico: "image",
  mp4: "video", mov: "video", webm: "video", mkv: "video", avi: "video",
  mp3: "audio", wav: "audio", flac: "audio", ogg: "audio", m4a: "audio",
  zip: "archive", tar: "archive", gz: "archive", rar: "archive", "7z": "archive",
  bz2: "archive", zst: "archive",
  js: "code", ts: "code", tsx: "code", jsx: "code", json: "code",
  html: "code", css: "code", py: "code", go: "code", rs: "code",
  sh: "code", ps1: "code", yml: "code", yaml: "code", sql: "code", toml: "code",
  csv: "spreadsheet", xls: "spreadsheet", xlsx: "spreadsheet",
  pdf: "pdf",
  txt: "document", md: "document", doc: "document", docx: "document",
  rtf: "document", log: "document",
};

export function FileIcon({ name, className }: { name: string; className?: string }) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const category = CATEGORIES[EXTENSIONS[extension]];
  const Icon = category?.icon ?? FileIconBase;
  return (
    <Icon
      className={cn(category?.className ?? "text-muted-foreground", className)}
      aria-hidden
    />
  );
}
