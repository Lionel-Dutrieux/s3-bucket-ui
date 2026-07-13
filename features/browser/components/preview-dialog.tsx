"use client";

import { Download, Link2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getPreviewUrl, getTextPreview } from "@/features/browser/actions";
import { categoryOf, isTextFile } from "@/features/browser/file-types";
import type { FileEntry } from "@/features/browser/listing";
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

interface LoadedPreview {
  key: string;
  url?: string;
  text?: string;
  truncated?: boolean;
  error?: string;
}

export function PreviewDialog({
  sourceId,
  file,
  onOpenChange,
  onCopyLink,
}: {
  sourceId: string;
  file: FileEntry | null;
  onOpenChange: (open: boolean) => void;
  onCopyLink: (file: FileEntry) => void;
}) {
  const [loaded, setLoaded] = useState<LoadedPreview | null>(null);

  // Presigned URLs are short-lived and text is fetched server-side, so one
  // load runs per opened file.
  useEffect(() => {
    if (!file) return;
    if (previewKindOf(file.name) === "text") {
      if (file.size === 0) {
        setLoaded({ key: file.key, text: "" });
        return;
      }
      let cancelled = false;
      getTextPreview(sourceId, file.key).then((result) => {
        if (!cancelled) setLoaded({ key: file.key, ...result });
      });
      return () => {
        cancelled = true;
      };
    }
    let cancelled = false;
    getPreviewUrl(sourceId, file.key).then((result) => {
      if (!cancelled) {
        setLoaded({ key: file.key, url: result.url, error: result.error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sourceId, file]);

  const current = loaded?.key === file?.key ? loaded : null;
  const kind = file ? previewKindOf(file.name) : undefined;

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {file ? (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-6">{file.name}</DialogTitle>
              <DialogDescription>
                {formatBytes(file.size)}
                {file.lastModified ? (
                  <> · {formatDate(file.lastModified)}</>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
              {!current ? (
                <Loader2
                  className="size-6 animate-spin text-muted-foreground"
                  aria-label="Loading preview"
                />
              ) : current.error ? (
                <p className="p-6 text-sm text-muted-foreground">
                  {current.error}
                </p>
              ) : kind === "text" ? (
                <TextPreview
                  text={current.text}
                  truncated={current.truncated}
                />
              ) : !current.url ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Could not load a preview for this file.
                </p>
              ) : kind === "image" ? (
                // biome-ignore lint/performance/noImgElement: presigned bucket URL, not optimizable
                <img
                  src={current.url}
                  alt={file.name}
                  className="max-h-[70vh] w-auto max-w-full object-contain"
                />
              ) : kind === "video" ? (
                // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
                <video
                  src={current.url}
                  controls
                  className="max-h-[70vh] w-full bg-black"
                />
              ) : kind === "audio" ? (
                // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
                <audio
                  src={current.url}
                  controls
                  className="w-full px-6 py-10"
                />
              ) : (
                // Empty sandbox: renders the PDF but blocks any scripts a
                // mislabeled object could smuggle in.
                <iframe
                  src={current.url}
                  sandbox=""
                  title={file.name}
                  className="h-[70vh] w-full"
                />
              )}
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
                <a
                  href={`/source/${sourceId}/download?key=${encodeURIComponent(file.key)}`}
                >
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
