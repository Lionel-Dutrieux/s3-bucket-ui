import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ShareMedia } from "@/features/shares/components/share-media";
import type { SharePreviewKind } from "@/features/shares/lib/preview";
import { shareDownloadHref, shareInlineSrc } from "@/features/shares/lib/urls";
import { formatBytes } from "@/lib/format";

export function PublicShareCard({
  token,
  filename,
  size,
  preview,
}: {
  token: string;
  filename: string;
  size: number;
  /** null → no inline preview, just the download button. */
  preview: SharePreviewKind | null;
}) {
  const t = useTranslations("shares.publicViewer");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="break-all text-base font-semibold">{filename}</h1>
        <p className="text-sm text-muted-foreground">{formatBytes(size)}</p>
      </div>

      {preview ? (
        <div className="flex items-center justify-center overflow-hidden rounded-md border bg-muted/40">
          <ShareMedia
            src={shareInlineSrc(token)}
            kind={preview}
            filename={filename}
            className={
              preview === "image"
                ? "max-h-[60vh] w-auto max-w-full object-contain"
                : preview === "video"
                  ? "max-h-[60vh] w-full bg-black"
                  : preview === "audio"
                    ? "w-full px-6 py-10"
                    : "h-[60vh] w-full"
            }
          />
        </div>
      ) : null}

      <Button asChild className="w-full">
        <a href={shareDownloadHref(token)}>
          <Download aria-hidden />
          {t("download")}
        </a>
      </Button>
    </div>
  );
}
