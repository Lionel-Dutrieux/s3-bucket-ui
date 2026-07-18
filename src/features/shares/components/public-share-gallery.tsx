"use client";

import {
  ChevronRight,
  Download,
  File as FileIcon,
  FileText,
  Folder,
  Image as ImageIcon,
  Music,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SharePreviewDialog } from "@/features/shares/components/share-preview-dialog";
import type {
  PublicFile,
  PublicFolder,
  ShareCrumb,
} from "@/features/shares/lib/gallery";
import type { SharePreviewKind } from "@/features/shares/lib/preview";
import { shareDownloadHref, shareInlineSrc } from "@/features/shares/lib/urls";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

// A subtle checkerboard keeps transparent images legible on both themes and
// stays invisible behind opaque photos (mirrors the browser grid's treatment).
const CHECKERBOARD_CLASS =
  "bg-muted/40 [background-image:linear-gradient(45deg,var(--muted)_25%,transparent_25%,transparent_75%,var(--muted)_75%),linear-gradient(45deg,var(--muted)_25%,transparent_25%,transparent_75%,var(--muted)_75%)] [background-position:0_0,10px_10px] [background-size:20px_20px]";

const KIND_ICON: Record<SharePreviewKind, typeof FileIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  pdf: FileText,
};

function iconFor(preview: SharePreviewKind | null): typeof FileIcon {
  return preview ? KIND_ICON[preview] : FileIcon;
}

/**
 * The public viewer for a prefix (folder) share: a breadcrumb trail bounded to
 * the shared root, sub-folder cards, and a gallery of the objects under the
 * current prefix. Images show a thumbnail; other previewable media open a
 * windowed preview; everything downloads. The server has already validated
 * every key here sits under share.key, and each download/preview re-validates
 * the boundary.
 */
export function PublicShareGallery({
  token,
  crumbs,
  folders,
  files,
}: {
  token: string;
  crumbs: ShareCrumb[];
  folders: PublicFolder[];
  files: PublicFile[];
}) {
  const t = useTranslations("shares.gallery");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const previewable = files.filter((file) => file.preview !== null);
  const openFile = files.find((file) => file.key === openKey) ?? null;

  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <div className="space-y-5">
      <nav
        aria-label={t("breadcrumbAria")}
        className="flex flex-wrap items-center gap-1 text-sm"
      >
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <span key={crumb.prefix} className="flex items-center gap-1">
              {index > 0 ? (
                <ChevronRight
                  className="size-3.5 text-muted-foreground"
                  aria-hidden
                />
              ) : null}
              {last ? (
                <span className="font-medium">{crumb.label}</span>
              ) : (
                <Link
                  href={{ pathname: `/s/${token}`, query: { p: crumb.prefix } }}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      {isEmpty ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : null}

      {folders.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-medium text-muted-foreground">
            {t("foldersHeading")}
          </h2>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))]">
            {folders.map((folder) => (
              <Link
                key={folder.prefix}
                href={{ pathname: `/s/${token}`, query: { p: folder.prefix } }}
                className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-3 transition-colors hover:bg-muted/50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Folder
                    className="size-4.5 fill-amber-400/80 text-primary"
                    aria-hidden
                  />
                </span>
                <span className="truncate text-sm font-medium">
                  {folder.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {files.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-medium text-muted-foreground">
            {t("filesHeading")}
          </h2>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))]">
            {files.map((file) => (
              <FileCard
                key={file.key}
                token={token}
                file={file}
                onOpen={() => setOpenKey(file.key)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <SharePreviewDialog
        token={token}
        file={openFile}
        files={previewable}
        onFileChange={(file) => setOpenKey(file.key)}
        onOpenChange={(open) => {
          if (!open) setOpenKey(null);
        }}
      />
    </div>
  );
}

function FileCard({
  token,
  file,
  onOpen,
}: {
  token: string;
  file: PublicFile;
  onOpen: () => void;
}) {
  const t = useTranslations("shares.gallery");
  const Icon = iconFor(file.preview);
  const previewable = file.preview !== null;

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50">
      <div
        className={cn(
          "flex aspect-[4/3] items-center justify-center overflow-hidden",
          file.preview === "image" ? CHECKERBOARD_CLASS : "bg-muted/40",
        )}
      >
        {file.preview === "image" ? (
          // biome-ignore lint/performance/noImgElement: streamed/presigned object, not optimizable
          <img
            src={shareInlineSrc(token, file.key)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <Icon className="size-12 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="space-y-0.5 border-t px-3 py-2">
        <p className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatBytes(file.size)}
        </p>
      </div>

      {/* Previewable files open the windowed preview on click; the download
        button sits above the overlay so it stays a distinct action. */}
      {previewable ? (
        <button
          type="button"
          onClick={onOpen}
          title={t("previewFile", { name: file.name })}
          className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="sr-only">
            {t("previewFile", { name: file.name })}
          </span>
        </button>
      ) : null}

      <a
        href={shareDownloadHref(token, file.key)}
        aria-label={t("downloadFileAria", { name: file.name })}
        title={t("download")}
        className="absolute right-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-md border bg-background/90 text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
      >
        <Download className="size-4" aria-hidden />
      </a>
    </div>
  );
}
