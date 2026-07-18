import type { SharePreviewKind } from "@/features/shares/lib/preview";

/**
 * The inline media element for a previewable shared object. Kept in one place so
 * the file card and the gallery's preview dialog render previews identically.
 * Only kinds the download route serves inline safely reach here (<img>/<video>/
 * <audio> never execute content; PDFs are forced to application/pdf + nosniff).
 */
export function ShareMedia({
  src,
  kind,
  filename,
  className,
}: {
  src: string;
  kind: SharePreviewKind;
  filename: string;
  className?: string;
}) {
  if (kind === "image") {
    return (
      // biome-ignore lint/performance/noImgElement: streamed/presigned object, not optimizable
      <img
        src={src}
        alt={filename}
        className={className ?? "max-h-[70vh] w-auto max-w-full object-contain"}
      />
    );
  }
  if (kind === "video") {
    return (
      // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
      <video
        src={src}
        controls
        className={className ?? "max-h-[70vh] w-full bg-black"}
      />
    );
  }
  if (kind === "audio") {
    return (
      // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
      <audio src={src} controls className={className ?? "w-full px-6 py-10"} />
    );
  }
  return (
    // No sandbox: Chrome blocks its PDF viewer in sandboxed frames. The route
    // only serves inline what is safe to render.
    <iframe
      src={src}
      title={filename}
      className={className ?? "h-[70vh] w-full"}
    />
  );
}
