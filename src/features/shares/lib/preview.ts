// Categories the public share page renders inline — the same safe set the
// browser preview uses: <img>/<video>/<audio> never execute content and the
// PDF goes into a sandboxed iframe / CSP-sandboxed stream.

export type SharePreviewKind = "image" | "pdf" | "video" | "audio";

const KINDS = new Set<string>(["image", "pdf", "video", "audio"]);

export function sharePreviewKind(
  category: string | undefined,
): SharePreviewKind | null {
  return category && KINDS.has(category)
    ? (category as SharePreviewKind)
    : null;
}
