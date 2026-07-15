"use client";

import type { ViewerProps } from "./types";

export function ImageViewer({ file, src, onError }: ViewerProps) {
  return (
    // biome-ignore lint/performance/noImgElement: presigned bucket URL, not optimizable
    <img
      src={src}
      alt={file.name}
      onError={onError}
      className="max-h-full w-auto max-w-full object-contain"
    />
  );
}
