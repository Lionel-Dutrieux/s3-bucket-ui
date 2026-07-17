"use client";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import type { PreviewKind } from "@/features/browser/lib/preview-kind";
import type { ViewerProps } from "./types";

function Loading() {
  const t = useTranslations("browser.viewers");
  return (
    <Loader2
      className="size-6 animate-spin text-muted-foreground"
      aria-label={t("loadingPreview")}
    />
  );
}

// One lazy chunk per viewer: opening an image never downloads shiki, and
// vice-versa. ssr:false — the dialog only exists client-side anyway.
function lazy<T extends ComponentType<ViewerProps>>(
  load: () => Promise<{ default?: unknown } & Record<string, unknown>>,
  name: string,
) {
  return dynamic(() => load().then((m) => m[name] as T), {
    ssr: false,
    loading: Loading,
  });
}

export const VIEWERS: Record<PreviewKind, ComponentType<ViewerProps>> = {
  image: lazy(() => import("./image-viewer"), "ImageViewer"),
  video: lazy(() => import("./video-viewer"), "VideoViewer"),
  audio: lazy(() => import("./audio-viewer"), "AudioViewer"),
  pdf: lazy(() => import("./pdf-viewer"), "PdfViewer"),
  text: lazy(() => import("./text-viewer"), "TextViewer"),
  code: lazy(() => import("./code-viewer"), "CodeViewer"),
  markdown: lazy(() => import("./markdown-viewer"), "MarkdownViewer"),
  csv: lazy(() => import("./csv-viewer"), "CsvViewer"),
};
