"use client";

import type { ViewerProps } from "./types";

export function AudioViewer({ src, onError }: ViewerProps) {
  return (
    // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
    <audio
      src={src}
      controls
      onError={onError}
      className="w-full max-w-xl px-6"
    />
  );
}
