"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Copy, Download, Loader2, Share2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadUrl, thumbnailSrc } from "@/features/browser/api/client";
import { browserQueries } from "@/features/browser/api/queries";
import { FileIcon } from "@/features/browser/components/file-icon";
import { categoryOf } from "@/features/browser/lib/file-types";
import type { FileEntry } from "@/features/browser/lib/listing";
import {
  CHECKERBOARD_CLASS,
  isVectorImage,
} from "@/features/browser/lib/thumbs";
import { copyText } from "@/lib/clipboard";
import { formatBytes, formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Object metadata (HEAD request) in a non-blocking side panel: an inline
 * sticky column on desktop, an edge panel on small screens. The browser
 * stays interactive, so clicking another file just swaps the content.
 */
export function DetailsPanel({
  sourceId,
  file,
  onClose,
  onShare,
}: {
  sourceId: string;
  file: FileEntry;
  onClose: () => void;
  /** Absent when sharing is off (instance-wide setting) — hides the action. */
  onShare?: (file: FileEntry) => void;
}) {
  const t = useTranslations("browser.detailsPanel");
  const locale = useLocale();
  const {
    data: details,
    error,
    isPending,
  } = useQuery(browserQueries.fileDetails(sourceId, file.key));

  const handleCopyKey = async () => {
    if (await copyText(file.key)) {
      toast.success(t("copiedToast"));
    } else {
      toast.error(t("copyFailedToast"));
    }
  };

  return (
    <aside
      aria-label={t("ariaLabel")}
      className="fixed inset-y-0 right-0 z-40 flex w-[85vw] max-w-sm flex-col gap-3 overflow-y-auto border-l bg-background p-4 shadow-lg md:sticky md:top-[4.25rem] md:z-auto md:max-h-[calc(100dvh-5.5rem)] md:w-72 md:shrink-0 md:rounded-lg md:border md:bg-card md:shadow-none"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 truncate pt-1 font-heading text-base font-medium">
          {file.name}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={onClose}
          aria-label={t("closeAria")}
        >
          <X aria-hidden />
        </Button>
      </div>

      {/* Visual anchor: the image itself when there is one, the type icon
          otherwise — the Drive panel pattern. */}
      <div
        className={cn(
          "flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border",
          categoryOf(file.name) === "image"
            ? CHECKERBOARD_CLASS
            : "bg-muted/40",
        )}
      >
        {categoryOf(file.name) === "image" ? (
          // biome-ignore lint/performance/noImgElement: redirects to a presigned bucket URL, not optimizable
          <img
            src={thumbnailSrc(sourceId, file.key)}
            alt=""
            loading="lazy"
            className={cn(
              "h-full w-full",
              isVectorImage(file.name) ? "object-contain p-4" : "object-cover",
            )}
          />
        ) : (
          <FileIcon name={file.name} className="size-14" />
        )}
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
          aria-label={t("copyKeyAria")}
          title={t("copyKeyTitle")}
        >
          <Copy className="size-3.5" aria-hidden />
        </Button>
      </div>

      {isPending ? (
        <div className="flex justify-center py-6">
          <Loader2
            className="size-5 animate-spin text-muted-foreground"
            aria-label={t("loadingAria")}
          />
        </div>
      ) : error || !details ? (
        <p className="py-2 text-sm text-muted-foreground">
          {error?.message ?? t("loadError")}
        </p>
      ) : (
        <>
          <dl className="grid gap-y-3 text-sm">
            <DetailRow label={t("size")}>
              <span className="tabular-nums">{formatBytes(details.size)}</span>
            </DetailRow>
            <DetailRow label={t("modified")}>
              {details.lastModified ? (
                <span
                  title={formatDateTime(new Date(details.lastModified), locale)}
                  suppressHydrationWarning
                >
                  {formatRelative(details.lastModified, locale)}
                </span>
              ) : (
                "—"
              )}
            </DetailRow>
          </dl>
          {/* Content-Type, ETag and custom metadata are developer-facing —
              useful, but folded away so they don't compete with size/date. */}
          <details className="group/tech">
            <summary className="flex cursor-pointer select-none items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
              <ChevronRight
                className="size-3 transition-transform group-open/tech:rotate-90"
                aria-hidden
              />
              {t("technical")}
            </summary>
            <dl className="mt-2 grid gap-y-3 pl-4 text-sm">
              <DetailRow label={t("contentType")}>
                <span className="font-mono text-xs">
                  {details.contentType ?? "—"}
                </span>
              </DetailRow>
              {details.etag ? (
                <DetailRow label={t("etag")}>
                  <span className="break-all font-mono text-xs text-muted-foreground">
                    {details.etag}
                  </span>
                </DetailRow>
              ) : null}
              {Object.entries(details.metadata ?? {}).map(([name, value]) => (
                <DetailRow key={name} label={name}>
                  <span className="break-all font-mono text-xs">{value}</span>
                </DetailRow>
              ))}
            </dl>
          </details>
        </>
      )}

      <div className="mt-auto flex gap-2 pt-2">
        {onShare ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onShare(file)}
          >
            <Share2 aria-hidden />
            {t("share")}
          </Button>
        ) : null}
        <Button asChild className="flex-1">
          <a href={downloadUrl(sourceId, file.key)}>
            <Download aria-hidden />
            {t("download")}
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
      <dd className="leading-5">{children}</dd>
    </div>
  );
}
