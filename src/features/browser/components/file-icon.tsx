import {
  FileArchive,
  FileAudio,
  FileCode,
  File as FileIconBase,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  type LucideIcon,
} from "lucide-react";
import {
  categoryOf,
  type FileCategory,
} from "@/features/browser/lib/file-types";
import { cn } from "@/lib/utils";

// Google-Drive-style: each file category gets an icon AND a color.
const CATEGORY_ICONS: Record<
  FileCategory,
  { icon: LucideIcon; className: string }
> = {
  image: { icon: FileImage, className: "text-emerald-500" },
  video: { icon: FileVideo, className: "text-rose-500" },
  audio: { icon: FileAudio, className: "text-orange-500" },
  archive: { icon: FileArchive, className: "text-primary" },
  code: { icon: FileCode, className: "text-sky-500" },
  spreadsheet: { icon: FileSpreadsheet, className: "text-green-600" },
  pdf: { icon: FileText, className: "text-red-500" },
  document: { icon: FileText, className: "text-blue-500" },
};

export function FileIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const category = categoryOf(name);
  const entry = category ? CATEGORY_ICONS[category] : undefined;
  const Icon = entry?.icon ?? FileIconBase;
  return (
    <Icon
      className={cn(entry?.className ?? "text-muted-foreground", className)}
      aria-hidden
    />
  );
}
