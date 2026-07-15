"use client";

import { useQuery } from "@tanstack/react-query";
import { Copy, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadUrl } from "@/features/browser/api/client";
import { browserQueries } from "@/features/browser/api/queries";
import type { FileEntry } from "@/features/browser/lib/listing";
import { copyText } from "@/lib/clipboard";
import { formatBytes, formatDate } from "@/lib/format";

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
  const key = file?.key;
  const {
    data: details,
    error,
    isPending,
  } = useQuery({
    ...browserQueries.fileDetails(sourceId, key ?? ""),
    enabled: key !== undefined,
  });

  const handleCopyKey = async (key: string) => {
    if (await copyText(key)) {
      toast.success("Key copied");
    } else {
      toast.error("Copy failed — your browser blocked clipboard access.");
    }
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

            {isPending ? (
              <div className="flex justify-center py-6">
                <Loader2
                  className="size-5 animate-spin text-muted-foreground"
                  aria-label="Loading details"
                />
              </div>
            ) : error || !details ? (
              <p className="py-2 text-sm text-muted-foreground">
                {error?.message ?? "Could not load the details for this file."}
              </p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <DetailRow label="Size">{formatBytes(details.size)}</DetailRow>
                <DetailRow label="Content-Type">
                  {details.contentType ?? "—"}
                </DetailRow>
                <DetailRow label="ETag">{details.etag ?? "—"}</DetailRow>
                <DetailRow label="Modified">
                  {details.lastModified
                    ? formatDate(details.lastModified)
                    : "—"}
                </DetailRow>
                {Object.entries(details.metadata ?? {}).map(([name, value]) => (
                  <DetailRow key={name} label={name}>
                    {value}
                  </DetailRow>
                ))}
              </dl>
            )}

            <DialogFooter>
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
