"use client";

import type { ViewerProps } from "./types";

export function PdfViewer({ file, src }: ViewerProps) {
  return (
    // No sandbox: Chrome refuses to run its PDF viewer in a sandboxed frame
    // ("This page has been blocked"). Safe regardless: presigned URLs render
    // on the bucket origin, and the streaming route forces application/pdf
    // + nosniff so a mislabeled object can't execute as HTML.
    <iframe src={src} title={file.name} className="h-full w-full" />
  );
}
