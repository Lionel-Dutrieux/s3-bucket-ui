"use client";

import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShareMedia } from "@/features/shares/components/share-media";
import type { PublicFile } from "@/features/shares/lib/gallery";
import { shareDownloadHref, shareInlineSrc } from "@/features/shares/lib/urls";
import { formatBytes } from "@/lib/format";

const NAV_BUTTON_CLASS =
  "absolute top-1/2 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground";

/**
 * Windowed preview for a prefix share, mirroring the browser's preview dialog:
 * the current object renders inline, ←/→ browse the previewable files, and a
 * download button is always offered. Only files carrying a preview kind land
 * here — non-media stay download-only tiles in the gallery.
 */
export function SharePreviewDialog({
  token,
  file,
  files,
  onFileChange,
  onOpenChange,
}: {
  token: string;
  /** The open file, or null when the dialog is closed. */
  file: PublicFile | null;
  /** Previewable files in display order, for ←/→ browsing. */
  files: PublicFile[];
  onFileChange: (file: PublicFile) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("shares.gallery");

  const index = file ? files.findIndex((f) => f.key === file.key) : -1;
  const previous = index > 0 ? files[index - 1] : undefined;
  const next =
    index >= 0 && index < files.length - 1 ? files[index + 1] : undefined;

  const handleKeyDown = (event: React.KeyboardEvent) => {
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
              {file.preview ? (
                <ShareMedia
                  key={file.key}
                  src={shareInlineSrc(token, file.key)}
                  kind={file.preview}
                  filename={file.name}
                  className={
                    file.preview === "image"
                      ? "max-h-full w-auto max-w-full object-contain"
                      : file.preview === "video"
                        ? "max-h-full w-full bg-black"
                        : file.preview === "audio"
                          ? "w-full px-6 py-10"
                          : "h-full w-full"
                  }
                />
              ) : null}
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
              <Button asChild>
                <a href={shareDownloadHref(token, file.key)}>
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
