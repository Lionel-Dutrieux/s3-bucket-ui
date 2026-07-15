"use client";

import type { ViewerProps } from "./types";

export function PdfViewer({ file, src }: ViewerProps) {
  return (
    // Empty sandbox: renders the PDF but blocks any scripts a mislabeled
    // object could smuggle in.
    <iframe src={src} sandbox="" title={file.name} className="h-full w-full" />
  );
}
