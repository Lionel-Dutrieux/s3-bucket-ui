"use client";

import type { ViewerProps } from "./types";

export function VideoViewer({ src, onError }: ViewerProps) {
  return (
    // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
    <video
      src={src}
      controls
      onError={onError}
      className="max-h-full w-full bg-black"
    />
  );
}
