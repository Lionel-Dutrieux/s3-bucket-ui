"use client";

import { ChevronLeft, ChevronRight, Download, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadUrl, previewSrc } from "@/features/browser/api/client";
import type { FileEntry } from "@/features/browser/lib/listing";
import { previewKindOf } from "@/features/browser/lib/preview-kind";
import { formatBytes, formatDate } from "@/lib/format";
import { VIEWERS } from "../viewers/registry";

const NAV_BUTTON_CLASS =
  "absolute top-1/2 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground";

export function PreviewDialog({
  sourceId,
  file,
  files,
  onFileChange,
  onOpenChange,
  onShare,
}: {
  sourceId: string;
  file: FileEntry | null;
  /** Previewable files of the folder, in display order, for ←/→ browsing. */
  files: FileEntry[];
  onFileChange: (file: FileEntry) => void;
  onOpenChange: (open: boolean) => void;
  /** Absent when sharing is disabled — hides the action. */
  onShare?: (file: FileEntry) => void;
}) {
  const t = useTranslations("browser.previewDialog");
  const locale = useLocale();
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const kind = file ? previewKindOf(file.name) : undefined;
  const src = file ? previewSrc(sourceId, file.key) : "";
  const mediaError = file !== null && failedKey === file.key;

  const index = file ? files.findIndex((f) => f.key === file.key) : -1;
  const previous = index > 0 ? files[index - 1] : undefined;
  const next =
    index >= 0 && index < files.length - 1 ? files[index + 1] : undefined;

  // Warm the neighbours' images while the current file is on screen — this
  // is what makes ←/→ feel instant.
  useEffect(() => {
    for (const neighbour of [previous, next]) {
      if (neighbour && previewKindOf(neighbour.name) === "image") {
        const img = new window.Image();
        img.src = previewSrc(sourceId, neighbour.key);
      }
    }
  }, [previous, next, sourceId]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Focused media elements use the arrow keys to seek — leave them alone.
    const target = event.target;
    if (
      target instanceof HTMLVideoElement ||
      target instanceof HTMLAudioElement
    ) {
      return;
    }
    if (event.key === "ArrowLeft" && previous) {
      event.preventDefault();
      onFileChange(previous);
    } else if (event.key === "ArrowRight" && next) {
      event.preventDefault();
      onFileChange(next);
    }
  };

  const Viewer = kind ? VIEWERS[kind] : undefined;

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[94dvh] w-[96vw] max-w-none flex-col gap-3 p-4 sm:max-w-none"
        onKeyDown={handleKeyDown}
      >
        {file ? (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-6">{file.name}</DialogTitle>
              <DialogDescription>
                {formatBytes(file.size)}
                {file.lastModified ? (
                  <> · {formatDate(file.lastModified, locale)}</>
                ) : null}
                {index >= 0 && files.length > 1 ? (
                  <>
                    {" "}
                    ·{" "}
                    {t("indexOfTotal", {
                      index: index + 1,
                      total: files.length,
                    })}
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
              {mediaError || !Viewer ? (
                <p className="p-6 text-sm text-muted-foreground">
                  {t("noPreview")}
                </p>
              ) : (
                <Viewer
                  key={file.key}
                  sourceId={sourceId}
                  file={file}
                  src={src}
                  onError={() => setFailedKey(file.key)}
                />
              )}
              {previous ? (
                <button
                  type="button"
                  onClick={() => onFileChange(previous)}
                  className={`${NAV_BUTTON_CLASS} left-2`}
                  aria-label={t("previousFileAria", { name: previous.name })}
                  title={t("previousFileTitle")}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
              ) : null}
              {next ? (
                <button
                  type="button"
                  onClick={() => onFileChange(next)}
                  className={`${NAV_BUTTON_CLASS} right-2`}
                  aria-label={t("nextFileAria", { name: next.name })}
                  title={t("nextFileTitle")}
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>

            <DialogFooter>
              {onShare ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onShare(file)}
                >
                  <Share2 aria-hidden />
                  {t("share")}
                </Button>
              ) : null}
              <Button asChild>
                <a href={downloadUrl(sourceId, file.key)}>
                  <Download aria-hidden />
                  {t("download")}
                </a>
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
