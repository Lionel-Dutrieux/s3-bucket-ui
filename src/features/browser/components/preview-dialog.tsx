"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Link2,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { downloadUrl, previewSrc } from "@/features/browser/api/client";
import { browserQueries } from "@/features/browser/api/queries";
import { categoryOf, isTextFile } from "@/features/browser/lib/file-types";
import type { FileEntry } from "@/features/browser/lib/listing";
import { formatBytes, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PreviewKind = "image" | "pdf" | "video" | "audio" | "text";

/** How the dialog renders a file, or undefined when it can't. */
export function previewKindOf(name: string): PreviewKind | undefined {
  const category = categoryOf(name);
  if (
    category === "image" ||
    category === "pdf" ||
    category === "video" ||
    category === "audio"
  ) {
    return category;
  }
  return isTextFile(name) ? "text" : undefined;
}

/** Kinds the dialog can render without executing bucket content. */
export function isPreviewable(name: string): boolean {
  return previewKindOf(name) !== undefined;
}

const NAV_BUTTON_CLASS =
  "absolute top-1/2 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground";

export function PreviewDialog({
  sourceId,
  file,
  files,
  onFileChange,
  onOpenChange,
  onCopyLink,
}: {
  sourceId: string;
  file: FileEntry | null;
  /** Previewable files of the folder, in display order, for ←/→ browsing. */
  files: FileEntry[];
  onFileChange: (file: FileEntry) => void;
  onOpenChange: (open: boolean) => void;
  onCopyLink: (file: FileEntry) => void;
}) {
  // Key of the media file whose element failed to load — cleared implicitly
  // when the dialog moves to another file.
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const kind = file ? previewKindOf(file.name) : undefined;

  // Media kinds point their src straight at /source/[id]/preview (which
  // redirects to a presigned URL) — only text needs a fetch, because bucket
  // CORS never lets the browser read object bodies. Empty files skip it too.
  const key = file?.key;
  const textQuery = useQuery({
    ...browserQueries.textPreview(sourceId, key ?? ""),
    enabled: file !== null && kind === "text" && file.size > 0,
  });

  const src = file ? previewSrc(sourceId, file.key) : "";
  const mediaError = file !== null && failedKey === file.key;

  const index = file ? files.findIndex((f) => f.key === file.key) : -1;
  const previous = index > 0 ? files[index - 1] : undefined;
  const next =
    index >= 0 && index < files.length - 1 ? files[index + 1] : undefined;

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

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" onKeyDown={handleKeyDown}>
        {file ? (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-6">{file.name}</DialogTitle>
              <DialogDescription>
                {formatBytes(file.size)}
                {file.lastModified ? (
                  <> · {formatDate(file.lastModified)}</>
                ) : null}
                {index >= 0 && files.length > 1 ? (
                  <>
                    {" "}
                    · {index + 1} of {files.length}
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
              {kind === "text" ? (
                file.size === 0 ? (
                  <TextPreview text="" />
                ) : textQuery.isPending ? (
                  <Loader2
                    className="size-6 animate-spin text-muted-foreground"
                    aria-label="Loading preview"
                  />
                ) : textQuery.error ? (
                  <p className="p-6 text-sm text-muted-foreground">
                    {textQuery.error.message}
                  </p>
                ) : (
                  <TextPreview
                    text={textQuery.data?.text}
                    truncated={textQuery.data?.truncated}
                  />
                )
              ) : mediaError || !kind ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Could not load a preview for this file.
                </p>
              ) : kind === "image" ? (
                // biome-ignore lint/performance/noImgElement: presigned bucket URL, not optimizable
                <img
                  src={src}
                  alt={file.name}
                  onError={() => setFailedKey(file.key)}
                  className="max-h-[70vh] w-auto max-w-full object-contain"
                />
              ) : kind === "video" ? (
                // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
                <video
                  src={src}
                  controls
                  onError={() => setFailedKey(file.key)}
                  className="max-h-[70vh] w-full bg-black"
                />
              ) : kind === "audio" ? (
                // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
                <audio
                  src={src}
                  controls
                  onError={() => setFailedKey(file.key)}
                  className="w-full px-6 py-10"
                />
              ) : (
                // Empty sandbox: renders the PDF but blocks any scripts a
                // mislabeled object could smuggle in.
                <iframe
                  src={src}
                  sandbox=""
                  title={file.name}
                  className="h-[70vh] w-full"
                />
              )}
              {previous ? (
                <button
                  type="button"
                  onClick={() => onFileChange(previous)}
                  className={`${NAV_BUTTON_CLASS} left-2`}
                  aria-label={`Previous file: ${previous.name}`}
                  title="Previous file (←)"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
              ) : null}
              {next ? (
                <button
                  type="button"
                  onClick={() => onFileChange(next)}
                  className={`${NAV_BUTTON_CLASS} right-2`}
                  aria-label={`Next file: ${next.name}`}
                  title="Next file (→)"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onCopyLink(file)}
              >
                <Link2 aria-hidden />
                Copy link
              </Button>
              <Button asChild>
                <a href={downloadUrl(sourceId, file.key)}>
                  <Download aria-hidden />
                  Download
                </a>
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TextPreview({
  text,
  truncated,
}: {
  text?: string;
  truncated?: boolean;
}) {
  if (text === undefined || text === "") {
    return (
      <p className="p-6 text-sm text-muted-foreground">This file is empty.</p>
    );
  }
  return (
    <div className="max-h-[70vh] w-full self-stretch overflow-auto">
      {truncated ? (
        <p className="sticky top-0 border-b bg-muted px-4 py-1.5 text-xs text-muted-foreground">
          Showing the first 1 MB of this file.
        </p>
      ) : null}
      <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs">
        {text}
      </pre>
    </div>
  );
}
