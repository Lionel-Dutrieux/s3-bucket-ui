"use client";

import { useEffect, useState } from "react";
import { Download, Link2, Loader2 } from "lucide-react";
import { getPreviewUrl } from "@/features/browser/actions";
import { categoryOf } from "@/features/browser/file-types";
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

/** Categories the dialog can render without executing bucket content. */
export function isPreviewable(name: string): boolean {
  const category = categoryOf(name);
  return category === "image" || category === "pdf";
}

interface LoadedUrl {
  key: string;
  url?: string;
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
  const [loaded, setLoaded] = useState<LoadedUrl | null>(null);

  // Presigned URLs are short-lived, so one is fetched per opened file.
  useEffect(() => {
    if (!file) return;
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
  const category = file ? categoryOf(file.name) : undefined;

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {file ? (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-6">{file.name}</DialogTitle>
              <DialogDescription>
                {formatBytes(file.size)}
                {file.lastModified ? <> · {formatDate(file.lastModified)}</> : null}
              </DialogDescription>
            </DialogHeader>

            <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
              {!current ? (
                <Loader2
                  className="size-6 animate-spin text-muted-foreground"
                  aria-label="Loading preview"
                />
              ) : current.error || !current.url ? (
                <p className="p-6 text-sm text-muted-foreground">
                  {current.error ?? "Could not load a preview for this file."}
                </p>
              ) : category === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- presigned bucket URL, not optimizable
                <img
                  src={current.url}
                  alt={file.name}
                  className="max-h-[70vh] w-auto max-w-full object-contain"
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
