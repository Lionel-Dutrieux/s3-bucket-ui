// Categories the public share page renders inline — the same safe set the
// browser preview uses: <img>/<video>/<audio> never execute content and the
// PDF stream is forced to application/pdf + nosniff (no sandbox — Chrome
// blocks its PDF viewer in sandboxed contexts).

export type SharePreviewKind = "image" | "pdf" | "video" | "audio";

const KINDS = new Set<string>(["image", "pdf", "video", "audio"]);

export function sharePreviewKind(
  category: string | undefined,
): SharePreviewKind | null {
  return category && KINDS.has(category)
    ? (category as SharePreviewKind)
    : null;
}
