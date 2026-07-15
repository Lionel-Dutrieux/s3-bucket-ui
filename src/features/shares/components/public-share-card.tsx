import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SharePreviewKind } from "@/features/shares/lib/preview";
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
  const downloadHref = `/api/s/${token}/download`;
  const inlineSrc = `/api/s/${token}/download?inline=1`;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="break-all text-base font-semibold">{filename}</h1>
        <p className="text-sm text-muted-foreground">{formatBytes(size)}</p>
      </div>

      {preview ? (
        <div className="flex items-center justify-center overflow-hidden rounded-md border bg-muted/40">
          {preview === "image" ? (
            // biome-ignore lint/performance/noImgElement: streamed/presigned object, not optimizable
            <img
              src={inlineSrc}
              alt={filename}
              className="max-h-[60vh] w-auto max-w-full object-contain"
            />
          ) : preview === "video" ? (
            // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
            <video
              src={inlineSrc}
              controls
              className="max-h-[60vh] w-full bg-black"
            />
          ) : preview === "audio" ? (
            // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
            <audio src={inlineSrc} controls className="w-full px-6 py-10" />
          ) : (
            // Empty sandbox: renders the PDF, blocks any smuggled scripts.
            <iframe
              src={inlineSrc}
              sandbox=""
              title={filename}
              className="h-[60vh] w-full"
            />
          )}
        </div>
      ) : null}

      <Button asChild className="w-full">
        <a href={downloadHref}>
          <Download aria-hidden />
          Download
        </a>
      </Button>
    </div>
  );
}
