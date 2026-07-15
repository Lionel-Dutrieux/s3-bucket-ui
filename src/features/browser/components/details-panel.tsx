"use client";

import { useQuery } from "@tanstack/react-query";
import { Copy, Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadUrl } from "@/features/browser/api/client";
import { browserQueries } from "@/features/browser/api/queries";
import type { FileEntry } from "@/features/browser/lib/listing";
import { copyText } from "@/lib/clipboard";
import { formatBytes, formatDate } from "@/lib/format";

/**
 * Object metadata (HEAD request) in a non-blocking side panel: an inline
 * sticky column on desktop, an edge panel on small screens. The browser
 * stays interactive, so clicking another file just swaps the content.
 */
export function DetailsPanel({
  sourceId,
  file,
  onClose,
}: {
  sourceId: string;
  file: FileEntry;
  onClose: () => void;
}) {
  const {
    data: details,
    error,
    isPending,
  } = useQuery(browserQueries.fileDetails(sourceId, file.key));

  const handleCopyKey = async () => {
    if (await copyText(file.key)) {
      toast.success("Key copied");
    } else {
      toast.error("Copy failed — your browser blocked clipboard access.");
    }
  };

  return (
    <aside
      aria-label="File details"
      className="fixed inset-y-0 right-0 z-40 flex w-[85vw] max-w-sm flex-col gap-3 overflow-y-auto border-l bg-background p-4 shadow-lg md:sticky md:top-[4.25rem] md:z-auto md:max-h-[calc(100dvh-5.5rem)] md:w-72 md:shrink-0 md:rounded-lg md:border md:shadow-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-heading text-base font-medium">
            {file.name}
          </h2>
          <p className="text-sm text-muted-foreground">File details</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={onClose}
          aria-label="Close details"
        >
          <X aria-hidden />
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3">
        <code className="min-w-0 flex-1 break-all font-mono text-xs">
          {file.key}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={handleCopyKey}
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
        <dl className="grid gap-y-3 text-sm">
          <DetailRow label="Size">{formatBytes(details.size)}</DetailRow>
          <DetailRow label="Content-Type">
            {details.contentType ?? "—"}
          </DetailRow>
          <DetailRow label="ETag">{details.etag ?? "—"}</DetailRow>
          <DetailRow label="Modified">
            {details.lastModified ? formatDate(details.lastModified) : "—"}
          </DetailRow>
          {Object.entries(details.metadata ?? {}).map(([name, value]) => (
            <DetailRow key={name} label={name}>
              {value}
            </DetailRow>
          ))}
        </dl>
      )}

      <div className="mt-auto pt-2">
        <Button asChild className="w-full">
          <a href={downloadUrl(sourceId, file.key)}>
            <Download aria-hidden />
            Download
          </a>
        </Button>
      </div>
    </aside>
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
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-all font-mono text-xs leading-5">{children}</dd>
    </div>
  );
}
