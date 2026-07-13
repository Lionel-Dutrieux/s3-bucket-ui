"use client";

import { Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getFileDetails,
  type FileDetailsResult,
} from "@/features/browser/read-actions";
import type { FileEntry } from "@/features/browser/listing";
import { formatBytes, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LoadedDetails extends FileDetailsResult {
  key: string;
}

/** Object metadata (HEAD request) with a copy-the-key shortcut. */
export function DetailsDialog({
  sourceId,
  file,
  onOpenChange,
}: {
  sourceId: string;
  file: FileEntry | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [loaded, setLoaded] = useState<LoadedDetails | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    getFileDetails(sourceId, file.key).then((result) => {
      if (!cancelled) setLoaded({ key: file.key, ...result });
    });
    return () => {
      cancelled = true;
    };
  }, [sourceId, file]);

  const current = loaded?.key === file?.key ? loaded : null;

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    toast.success("Key copied");
  };

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {file ? (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-6">{file.name}</DialogTitle>
              <DialogDescription>File details</DialogDescription>
            </DialogHeader>

            <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3">
              <code className="min-w-0 flex-1 break-all font-mono text-xs">
                {file.key}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => handleCopyKey(file.key)}
                aria-label="Copy key"
                title="Copy key"
              >
                <Copy className="size-3.5" aria-hidden />
              </Button>
            </div>

            {!current ? (
              <div className="flex justify-center py-6">
                <Loader2
                  className="size-5 animate-spin text-muted-foreground"
                  aria-label="Loading details"
                />
              </div>
            ) : current.error || !current.details ? (
              <p className="py-2 text-sm text-muted-foreground">
                {current.error ?? "Could not load the details for this file."}
              </p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <DetailRow label="Size">
                  {formatBytes(current.details.size)}
                </DetailRow>
                <DetailRow label="Content-Type">
                  {current.details.contentType ?? "—"}
                </DetailRow>
                <DetailRow label="ETag">
                  {current.details.etag ?? "—"}
                </DetailRow>
                <DetailRow label="Modified">
                  {current.details.lastModified
                    ? formatDate(current.details.lastModified)
                    : "—"}
                </DetailRow>
                {Object.entries(current.details.metadata ?? {}).map(
                  ([name, value]) => (
                    <DetailRow key={name} label={name}>
                      {value}
                    </DetailRow>
                  ),
                )}
              </dl>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all font-mono text-xs leading-5">{children}</dd>
    </>
  );
}
