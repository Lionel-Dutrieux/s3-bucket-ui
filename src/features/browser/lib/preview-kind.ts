import { categoryOf, isTextFile } from "@/features/browser/lib/file-types";

// How the preview dialog renders a file — one entry per registered viewer.
// Media kinds stream through /preview; text-ish kinds fetch the (truncated)
// body through the text route.
export type PreviewKind =
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "code"
  | "markdown"
  | "csv"
  | "text";

export function previewKindOf(name: string): PreviewKind | undefined {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  // Before the category lookup: md sits in "document", csv in "spreadsheet",
  // but both have richer viewers than their category suggests.
  if (extension === "md" || extension === "markdown") return "markdown";
  if (extension === "csv") return "csv";

  const category = categoryOf(name);
  if (
    category === "image" ||
    category === "pdf" ||
    category === "video" ||
    category === "audio"
  ) {
    return category;
  }
  if (category === "code") return "code";
  return isTextFile(name) ? "text" : undefined;
}

/** Kinds the dialog can render without executing bucket content. */
export function isPreviewable(name: string): boolean {
  return previewKindOf(name) !== undefined;
}
