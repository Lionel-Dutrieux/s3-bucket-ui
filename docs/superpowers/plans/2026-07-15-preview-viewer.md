# Quality Preview Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the preview dialog into a quality viewer: URL-addressable (`?preview=`), full-screen lightbox, lazy per-kind viewer registry, image zoom/pan + neighbour preloading, Shiki syntax highlighting, rendered Markdown, and CSV tables.

**Architecture:** `previewKindOf` moves to a pure lib and gains `code | markdown | csv` kinds. The dialog becomes a thin full-screen shell that picks a viewer component from a registry of `next/dynamic` lazy imports — heavy dependencies (shiki, react-markdown) never touch the initial bundle. Preview selection moves from `useState` to a nuqs query param so links deep-link and Back closes the viewer. All data paths are unchanged: media kinds keep pointing at `/api/sources/[id]/preview`, text kinds keep using the existing 1 MiB text route via TanStack Query.

**Tech Stack:** Next.js 16 (App Router), nuqs 2, TanStack Query 5, shiki, react-markdown + remark-gfm, @tailwindcss/typography (Tailwind v4 `@plugin`), vitest.

## Global Constraints

- **Read `ARCHITECTURE.md` and relevant guides in `node_modules/next/dist/docs/` before coding** — this Next.js version has breaking changes vs. training data.
- No cross-feature imports (Biome-enforced); everything here stays inside `src/features/browser/` (+ `src/app/globals.css` for shiki theming).
- Reads never go through server actions; the existing GET routes are untouched.
- New dependencies allowed by this plan: `shiki`, `react-markdown`, `remark-gfm`, `@tailwindcss/typography`. Nothing else.
- All user-facing copy in **English**.
- Verify each task with `pnpm typecheck && pnpm lint && pnpm test`; `pnpm build` at the end. No E2E — the user tests the UI manually.

---

### Task 1: Extract and extend `previewKindOf` into a pure lib

**Files:**
- Create: `src/features/browser/lib/preview-kind.ts`
- Create: `src/features/browser/lib/preview-kind.test.ts`
- Modify: `src/features/browser/components/preview-dialog.tsx:27-46` (delete the local copies, re-import)
- Modify: `src/features/browser/components/file-browser.tsx:63-66` (import `isPreviewable` from the lib)

**Interfaces:**
- Produces: `type PreviewKind = "image" | "pdf" | "video" | "audio" | "code" | "markdown" | "csv" | "text"`; `previewKindOf(name: string): PreviewKind | undefined`; `isPreviewable(name: string): boolean`. Every later task imports these from `@/features/browser/lib/preview-kind`.

- [ ] **Step 1: Write the failing test** — `src/features/browser/lib/preview-kind.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isPreviewable, previewKindOf } from "./preview-kind";

describe("previewKindOf", () => {
  it("maps media by category", () => {
    expect(previewKindOf("photo.JPG")).toBe("image");
    expect(previewKindOf("doc.pdf")).toBe("pdf");
    expect(previewKindOf("clip.webm")).toBe("video");
    expect(previewKindOf("song.flac")).toBe("audio");
  });

  it("markdown and csv get their own viewers", () => {
    expect(previewKindOf("README.md")).toBe("markdown");
    expect(previewKindOf("notes.markdown")).toBe("markdown");
    expect(previewKindOf("data.csv")).toBe("csv");
  });

  it("code extensions get the code viewer", () => {
    expect(previewKindOf("app.ts")).toBe("code");
    expect(previewKindOf("config.yaml")).toBe("code");
  });

  it("plain text documents fall back to text", () => {
    expect(previewKindOf("readme.txt")).toBe("text");
    expect(previewKindOf("server.log")).toBe("text");
  });

  it("binary/unknown files have no preview", () => {
    expect(previewKindOf("archive.zip")).toBeUndefined();
    expect(previewKindOf("report.docx")).toBeUndefined();
    expect(previewKindOf("no-extension")).toBeUndefined();
    expect(isPreviewable("archive.zip")).toBe(false);
    expect(isPreviewable("photo.png")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm vitest run src/features/browser/lib/preview-kind.test.ts`
Expected: FAIL — module `./preview-kind` not found.

- [ ] **Step 3: Implement** — `src/features/browser/lib/preview-kind.ts`:

```ts
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
```

- [ ] **Step 4: Re-point the imports.** In `preview-dialog.tsx` delete the local `PreviewKind`/`previewKindOf`/`isPreviewable` definitions (lines 27-46) and import them from `@/features/browser/lib/preview-kind`; the dialog's `kind === "text"` branch must for now also handle `"code" | "markdown" | "csv"` identically — change the condition to:

```ts
const isTextual =
  kind === "text" || kind === "code" || kind === "markdown" || kind === "csv";
```

and use `isTextual` where the dialog tested `kind === "text"` (the render branch and the `textQuery` `enabled` flag). In `file-browser.tsx`, import `isPreviewable` from the lib instead of the dialog.

- [ ] **Step 5: Run tests, verify, commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

```bash
git add src/features/browser
git commit -m "refactor(browser): previewKindOf as a pure lib with code/markdown/csv kinds"
```

---

### Task 2: URL-addressable preview (`?preview=<key>`)

**Files:**
- Modify: `src/features/browser/components/file-browser.tsx:134,247-258,488-497`

**Interfaces:**
- Consumes: `useQueryState`/`parseAsString` from `nuqs` (already used for `?q=` in this file).
- Produces: preview selection driven by the `preview` search param; `openPreview(file: FileEntry)` / close semantics used by table meta, grid and dialog.

- [ ] **Step 1: Swap the state.** In `file-browser.tsx`, replace `const [preview, setPreview] = useState<FileEntry | null>(null);` (line 134) with:

```ts
  // The previewed file lives in the URL: refresh restores it, Back closes it,
  // and the address bar is a deep link to "look at this file".
  const [previewKey, setPreviewKey] = useQueryState(
    "preview",
    parseAsString.withOptions({ history: "push" }),
  );
  const preview = useMemo(
    () =>
      previewKey === null
        ? null
        : (files.find((file) => file.key === previewKey) ?? null),
    [files, previewKey],
  );
  const openPreview = useCallback(
    (file: FileEntry) => setPreviewKey(file.key),
    [setPreviewKey],
  );
```

- [ ] **Step 2: Re-wire the call sites:**
  - table meta (line ~249): `onPreview: openPreview,`
  - grid (line ~462): `onPreview={openPreview}`
  - dialog (lines ~488-497): `onFileChange={openPreview}` and

```tsx
        onOpenChange={(open) => {
          if (!open) setPreviewKey(null);
        }}
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green. (Behavior note for the user's manual pass: a `?preview=` key that isn't in the current page's listing silently resolves to null — acceptable, the dialog just doesn't open.)

```bash
git add src/features/browser/components/file-browser.tsx
git commit -m "feat(browser): preview selection lives in the URL"
```

---

### Task 3: Viewer registry, lazy split, full-screen lightbox, preloading

**Files:**
- Create: `src/features/browser/components/viewers/types.ts`
- Create: `src/features/browser/components/viewers/registry.tsx`
- Create: `src/features/browser/components/viewers/image-viewer.tsx` (plain `<img>` for now — zoom lands in Task 4)
- Create: `src/features/browser/components/viewers/video-viewer.tsx`
- Create: `src/features/browser/components/viewers/audio-viewer.tsx`
- Create: `src/features/browser/components/viewers/pdf-viewer.tsx`
- Create: `src/features/browser/components/viewers/text-viewer.tsx`
- Modify: `src/features/browser/components/preview-dialog.tsx` (shell only: header, nav, footer, registry dispatch, full-screen sizing, preload effect)

**Interfaces:**
- Produces: `interface ViewerProps { sourceId: string; file: FileEntry; src: string; onError: () => void }` (`src` = `previewSrc(sourceId, file.key)`); `VIEWERS: Record<PreviewKind, ComponentType<ViewerProps>>`. Tasks 4-7 replace individual registry entries — the registry keys and `ViewerProps` must not change after this task.

- [ ] **Step 1: Shared types** — `src/features/browser/components/viewers/types.ts`:

```ts
import type { FileEntry } from "@/features/browser/lib/listing";

export interface ViewerProps {
  sourceId: string;
  file: FileEntry;
  /** Media source URL (the /preview route) — media viewers use it as-is. */
  src: string;
  /** Media element failed to load — the shell shows the fallback message. */
  onError: () => void;
}
```

- [ ] **Step 2: The five viewers.** Each is a small `"use client"` file moving the existing JSX out of the dialog:

`viewers/image-viewer.tsx`:

```tsx
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
```

`viewers/video-viewer.tsx`:

```tsx
"use client";

import type { ViewerProps } from "./types";

export function VideoViewer({ src, onError }: ViewerProps) {
  return (
    // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
    <video src={src} controls onError={onError} className="max-h-full w-full bg-black" />
  );
}
```

`viewers/audio-viewer.tsx`:

```tsx
"use client";

import type { ViewerProps } from "./types";

export function AudioViewer({ src, onError }: ViewerProps) {
  return (
    // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
    <audio src={src} controls onError={onError} className="w-full max-w-xl px-6" />
  );
}
```

`viewers/pdf-viewer.tsx`:

```tsx
"use client";

import type { ViewerProps } from "./types";

export function PdfViewer({ file, src }: ViewerProps) {
  return (
    // Empty sandbox: renders the PDF but blocks any scripts a mislabeled
    // object could smuggle in.
    <iframe src={src} sandbox="" title={file.name} className="h-full w-full" />
  );
}
```

`viewers/text-viewer.tsx` (also the temporary target for code/markdown/csv until Tasks 5-7; move `TextPreview` out of the dialog into here):

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { browserQueries } from "@/features/browser/api/queries";
import type { ViewerProps } from "./types";

export function TextViewer({ sourceId, file }: ViewerProps) {
  const query = useQuery({
    ...browserQueries.textPreview(sourceId, file.key),
    enabled: file.size > 0,
  });

  if (file.size === 0) return <TextBody text="" />;
  if (query.isPending) {
    return (
      <Loader2
        className="size-6 animate-spin text-muted-foreground"
        aria-label="Loading preview"
      />
    );
  }
  if (query.error) {
    return (
      <p className="p-6 text-sm text-muted-foreground">{query.error.message}</p>
    );
  }
  return <TextBody text={query.data?.text} truncated={query.data?.truncated} />;
}

export function TruncatedBanner() {
  return (
    <p className="sticky top-0 border-b bg-muted px-4 py-1.5 text-xs text-muted-foreground">
      Showing the first 1 MB of this file.
    </p>
  );
}

function TextBody({ text, truncated }: { text?: string; truncated?: boolean }) {
  if (text === undefined || text === "") {
    return (
      <p className="p-6 text-sm text-muted-foreground">This file is empty.</p>
    );
  }
  return (
    <div className="h-full w-full self-stretch overflow-auto">
      {truncated ? <TruncatedBanner /> : null}
      <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs">
        {text}
      </pre>
    </div>
  );
}
```

- [ ] **Step 3: Registry** — `src/features/browser/components/viewers/registry.tsx`:

```tsx
"use client";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { PreviewKind } from "@/features/browser/lib/preview-kind";
import type { ViewerProps } from "./types";

const loading = () => (
  <Loader2
    className="size-6 animate-spin text-muted-foreground"
    aria-label="Loading preview"
  />
);

// One lazy chunk per viewer: opening an image never downloads shiki, and
// vice-versa. ssr:false — the dialog only exists client-side anyway.
function lazy<T extends ComponentType<ViewerProps>>(
  load: () => Promise<{ default?: unknown } & Record<string, unknown>>,
  name: string,
) {
  return dynamic(() => load().then((m) => m[name] as T), {
    ssr: false,
    loading,
  });
}

export const VIEWERS: Record<PreviewKind, ComponentType<ViewerProps>> = {
  image: lazy(() => import("./image-viewer"), "ImageViewer"),
  video: lazy(() => import("./video-viewer"), "VideoViewer"),
  audio: lazy(() => import("./audio-viewer"), "AudioViewer"),
  pdf: lazy(() => import("./pdf-viewer"), "PdfViewer"),
  text: lazy(() => import("./text-viewer"), "TextViewer"),
  // Placeholders until their dedicated viewers land (Tasks 5-7):
  code: lazy(() => import("./text-viewer"), "TextViewer"),
  markdown: lazy(() => import("./text-viewer"), "TextViewer"),
  csv: lazy(() => import("./text-viewer"), "TextViewer"),
};
```

(If the `lazy` helper fights `next/dynamic`'s types, inline each `dynamic(() => import("./x").then((m) => m.X), { ssr: false, loading })` call — clarity over cleverness.)

- [ ] **Step 4: Rewrite the dialog shell.** `preview-dialog.tsx` becomes: full-screen content, header, viewer slot, nav arrows, footer, preload effect. Full replacement of the component body (keep the existing imports it still needs, drop `useQuery`/`browserQueries`/`TextPreview`):

```tsx
"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadUrl, previewSrc } from "@/features/browser/api/client";
import type { FileEntry } from "@/features/browser/lib/listing";
import { previewKindOf } from "@/features/browser/lib/preview-kind";
import { formatBytes, formatDate } from "@/lib/format";
import { VIEWERS } from "./viewers/registry";

const NAV_BUTTON_CLASS =
  "absolute top-1/2 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground";

export function PreviewDialog({
  sourceId,
  file,
  files,
  onFileChange,
  onOpenChange,
  onShare,
}: {
  sourceId: string;
  file: FileEntry | null;
  /** Previewable files of the folder, in display order, for ←/→ browsing. */
  files: FileEntry[];
  onFileChange: (file: FileEntry) => void;
  onOpenChange: (open: boolean) => void;
  /** Absent when sharing is disabled — hides the action. */
  onShare?: (file: FileEntry) => void;
}) {
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const kind = file ? previewKindOf(file.name) : undefined;
  const src = file ? previewSrc(sourceId, file.key) : "";
  const mediaError = file !== null && failedKey === file.key;

  const index = file ? files.findIndex((f) => f.key === file.key) : -1;
  const previous = index > 0 ? files[index - 1] : undefined;
  const next =
    index >= 0 && index < files.length - 1 ? files[index + 1] : undefined;

  // Warm the neighbours' images while the current file is on screen — this
  // is what makes ←/→ feel instant.
  useEffect(() => {
    for (const neighbour of [previous, next]) {
      if (neighbour && previewKindOf(neighbour.name) === "image") {
        const img = new window.Image();
        img.src = previewSrc(sourceId, neighbour.key);
      }
    }
  }, [previous, next, sourceId]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Focused media elements use the arrow keys to seek — leave them alone.
    const target = event.target;
    if (
      target instanceof HTMLVideoElement ||
      target instanceof HTMLAudioElement
    ) {
      return;
    }
    if (event.key === "ArrowLeft" && previous) {
      event.preventDefault();
      onFileChange(previous);
    } else if (event.key === "ArrowRight" && next) {
      event.preventDefault();
      onFileChange(next);
    }
  };

  const Viewer = kind ? VIEWERS[kind] : undefined;

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[94dvh] w-[96vw] max-w-none flex-col gap-3 p-4 sm:max-w-none"
        onKeyDown={handleKeyDown}
      >
        {file ? (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-6">{file.name}</DialogTitle>
              <DialogDescription>
                {formatBytes(file.size)}
                {file.lastModified ? (
                  <> · {formatDate(file.lastModified)}</>
                ) : null}
                {index >= 0 && files.length > 1 ? (
                  <>
                    {" "}
                    · {index + 1} of {files.length}
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
              {mediaError || !Viewer ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Could not load a preview for this file.
                </p>
              ) : (
                <Viewer
                  key={file.key}
                  sourceId={sourceId}
                  file={file}
                  src={src}
                  onError={() => setFailedKey(file.key)}
                />
              )}
              {previous ? (
                <button
                  type="button"
                  onClick={() => onFileChange(previous)}
                  className={`${NAV_BUTTON_CLASS} left-2`}
                  aria-label={`Previous file: ${previous.name}`}
                  title="Previous file (←)"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
              ) : null}
              {next ? (
                <button
                  type="button"
                  onClick={() => onFileChange(next)}
                  className={`${NAV_BUTTON_CLASS} right-2`}
                  aria-label={`Next file: ${next.name}`}
                  title="Next file (→)"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>

            <DialogFooter>
              {onShare ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onShare(file)}
                >
                  <Share2 aria-hidden />
                  Share
                </Button>
              ) : null}
              <Button asChild>
                <a href={downloadUrl(sourceId, file.key)}>
                  <Download aria-hidden />
                  Download
                </a>
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
```

Coordination notes:
- The `onShare` prop name matches the share-links plan (Task 8 there). **If that plan hasn't been executed yet**, keep the current name `onCopyLink` and the `Link2`/"Copy link" footer button — only the shell mechanics belong to this task.
- `key={file.key}` on `<Viewer>` resets per-file viewer state (zoom, failed loads) on navigation.

- [ ] **Step 5: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

```bash
git add src/features/browser/components
git commit -m "feat(browser): lazy viewer registry and full-screen preview lightbox"
```

---

### Task 4: Image zoom/pan

**Files:**
- Create: `src/features/browser/lib/zoom.ts`
- Create: `src/features/browser/lib/zoom.test.ts`
- Modify: `src/features/browser/components/viewers/image-viewer.tsx` (full rewrite)

**Interfaces:**
- Consumes: `ViewerProps` (Task 3).
- Produces: `interface ZoomState { scale: number; x: number; y: number }`, `INITIAL_ZOOM`, `ZOOM_MIN = 1`, `ZOOM_MAX = 8`, `clampScale(scale: number): number`, `zoomAt(state, cx, cy, factor): ZoomState`, `pan(state, dx, dy): ZoomState`.

- [ ] **Step 1: Write the failing tests** — `src/features/browser/lib/zoom.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clampScale,
  INITIAL_ZOOM,
  pan,
  zoomAt,
  ZOOM_MAX,
  ZOOM_MIN,
} from "./zoom";

describe("zoom", () => {
  it("clamps the scale to [min, max]", () => {
    expect(clampScale(0.1)).toBe(ZOOM_MIN);
    expect(clampScale(100)).toBe(ZOOM_MAX);
    expect(clampScale(2)).toBe(2);
  });

  it("zooming at the origin keeps the origin fixed", () => {
    const zoomed = zoomAt(INITIAL_ZOOM, 0, 0, 2);
    expect(zoomed).toEqual({ scale: 2, x: 0, y: 0 });
  });

  it("keeps the cursor point visually fixed while zooming", () => {
    // The image point under the cursor (screen coords c) is
    // p = (c - offset) / scale — it must not move after the zoom.
    const state = { scale: 2, x: 10, y: -20 };
    const cx = 100;
    const cy = 50;
    const before = { px: (cx - state.x) / state.scale, py: (cy - state.y) / state.scale };
    const zoomed = zoomAt(state, cx, cy, 1.5);
    const after = { px: (cx - zoomed.x) / zoomed.scale, py: (cy - zoomed.y) / zoomed.scale };
    expect(after.px).toBeCloseTo(before.px);
    expect(after.py).toBeCloseTo(before.py);
  });

  it("zooming out below 1 resets the offset", () => {
    const state = { scale: 1.2, x: 40, y: 40 };
    const zoomed = zoomAt(state, 0, 0, 0.5);
    expect(zoomed).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("pan shifts the offset, but is a no-op at scale 1", () => {
    expect(pan({ scale: 2, x: 0, y: 0 }, 5, -3)).toEqual({
      scale: 2,
      x: 5,
      y: -3,
    });
    expect(pan(INITIAL_ZOOM, 5, -3)).toBe(INITIAL_ZOOM);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/features/browser/lib/zoom.test.ts`
Expected: FAIL — module `./zoom` not found.

- [ ] **Step 3: Implement** — `src/features/browser/lib/zoom.ts`:

```ts
// Pure zoom/pan math for the image viewer. State is a CSS transform:
// translate(x, y) scale(scale), with (x, y) in screen pixels relative to the
// centered, fit-to-container image.

export interface ZoomState {
  scale: number;
  x: number;
  y: number;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 8;
export const INITIAL_ZOOM: ZoomState = { scale: 1, x: 0, y: 0 };

export function clampScale(scale: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale));
}

/**
 * Multiplies the scale by `factor`, keeping the point under the cursor
 * (cx, cy — screen coords in the same space as x/y) visually fixed.
 * Landing back on scale 1 recenters — a fully zoomed-out image is never
 * left panned off-center.
 */
export function zoomAt(
  state: ZoomState,
  cx: number,
  cy: number,
  factor: number,
): ZoomState {
  const scale = clampScale(state.scale * factor);
  if (scale === ZOOM_MIN) return INITIAL_ZOOM;
  const ratio = scale / state.scale;
  return {
    scale,
    x: cx - (cx - state.x) * ratio,
    y: cy - (cy - state.y) * ratio,
  };
}

/** Drag by (dx, dy). At scale 1 there is nothing to pan. */
export function pan(state: ZoomState, dx: number, dy: number): ZoomState {
  if (state.scale === ZOOM_MIN) return state;
  return { ...state, x: state.x + dx, y: state.y + dy };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/browser/lib/zoom.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Rewrite the image viewer** — `src/features/browser/components/viewers/image-viewer.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import {
  INITIAL_ZOOM,
  pan,
  zoomAt,
  type ZoomState,
} from "@/features/browser/lib/zoom";
import type { ViewerProps } from "./types";

/**
 * Image with wheel-zoom (cursor-anchored), drag-pan when zoomed, and
 * double-click to toggle 1x ↔ 2.5x. State resets per file via the shell's
 * key={file.key}.
 */
export function ImageViewer({ file, src, onError }: ViewerProps) {
  const [zoom, setZoom] = useState<ZoomState>(INITIAL_ZOOM);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(
    null,
  );

  /** Cursor position relative to the container center — zoom.ts's space. */
  const toLocal = (event: { clientX: number; clientY: number }) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { cx: 0, cy: 0 };
    return {
      cx: event.clientX - rect.left - rect.width / 2,
      cy: event.clientY - rect.top - rect.height / 2,
    };
  };

  const handleWheel = (event: React.WheelEvent) => {
    const { cx, cy } = toLocal(event);
    const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
    setZoom((state) => zoomAt(state, cx, cy, factor));
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    const { cx, cy } = toLocal(event);
    setZoom((state) =>
      state.scale > 1 ? INITIAL_ZOOM : zoomAt(state, cx, cy, 2.5),
    );
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (zoom.scale === 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setZoom((state) => pan(state, dx, dy));
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden"
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        cursor: zoom.scale > 1 ? "grab" : "zoom-in",
        touchAction: "none",
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: presigned bucket URL, not optimizable */}
      <img
        src={src}
        alt={file.name}
        onError={onError}
        draggable={false}
        className="max-h-full w-auto max-w-full object-contain select-none"
        style={{
          transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
          transition: dragRef.current ? "none" : "transform 120ms ease-out",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

```bash
git add src/features/browser
git commit -m "feat(browser): cursor-anchored zoom and pan in the image viewer"
```

---

### Task 5: Code viewer with Shiki

**Files:**
- Create: `src/features/browser/lib/language-of.ts`
- Create: `src/features/browser/lib/language-of.test.ts`
- Create: `src/features/browser/components/viewers/code-viewer.tsx`
- Modify: `src/features/browser/components/viewers/registry.tsx` (point `code` at it)
- Modify: `src/app/globals.css` (dark-theme override for shiki dual themes)

**Interfaces:**
- Consumes: `browserQueries.textPreview`, `TruncatedBanner` from `./text-viewer`, `ViewerProps`.
- Produces: `languageOf(name: string): string` (shiki lang id, `"text"` fallback).

- [ ] **Step 1: Install the dependency**

Run: `pnpm add shiki`
Expected: added to `dependencies` in `package.json`.

- [ ] **Step 2: Write the failing test** — `src/features/browser/lib/language-of.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { languageOf } from "./language-of";

describe("languageOf", () => {
  it("maps known extensions to shiki lang ids", () => {
    expect(languageOf("app.ts")).toBe("typescript");
    expect(languageOf("Component.tsx")).toBe("tsx");
    expect(languageOf("script.py")).toBe("python");
    expect(languageOf("main.rs")).toBe("rust");
    expect(languageOf("deploy.ps1")).toBe("powershell");
    expect(languageOf("config.YML")).toBe("yaml");
  });

  it("falls back to text for unknown extensions", () => {
    expect(languageOf("notes.txt")).toBe("text");
    expect(languageOf("no-extension")).toBe("text");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run src/features/browser/lib/language-of.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement** — `src/features/browser/lib/language-of.ts`:

```ts
// Extension → shiki language id, for the code viewer. Mirrors the "code"
// extensions in file-types.ts (plus md/csv relatives that reach the code
// path via toggles). Unknown → "text" (shiki renders it un-highlighted).

const LANGUAGES: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  json: "json",
  html: "html",
  css: "css",
  py: "python",
  go: "go",
  rs: "rust",
  sh: "shellscript",
  ps1: "powershell",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  toml: "toml",
  md: "markdown",
  markdown: "markdown",
};

export function languageOf(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGES[extension] ?? "text";
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/features/browser/lib/language-of.test.ts`
Expected: PASS.

- [ ] **Step 6: The viewer** — `src/features/browser/components/viewers/code-viewer.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { browserQueries } from "@/features/browser/api/queries";
import { languageOf } from "@/features/browser/lib/language-of";
import { TruncatedBanner } from "./text-viewer";
import type { ViewerProps } from "./types";

/**
 * Syntax-highlighted text via shiki, loaded on demand (the import lives in
 * the effect — this chunk stays small until a code file is actually opened).
 * Highlighting failures fall back to the plain <pre>, never to an error.
 */
export function CodeViewer({ sourceId, file }: ViewerProps) {
  const query = useQuery({
    ...browserQueries.textPreview(sourceId, file.key),
    enabled: file.size > 0,
  });
  const [html, setHtml] = useState<string | null>(null);

  const text = file.size === 0 ? "" : query.data?.text;

  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    (async () => {
      const { codeToHtml } = await import("shiki");
      const rendered = await codeToHtml(text, {
        lang: languageOf(file.name),
        themes: { light: "github-light", dark: "github-dark" },
      });
      if (!cancelled) setHtml(rendered);
    })().catch(() => {
      // Unknown lang / oversized input — the plain fallback below renders.
    });
    return () => {
      cancelled = true;
    };
  }, [text, file.name]);

  if (file.size === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">This file is empty.</p>
    );
  }
  if (query.isPending) {
    return (
      <Loader2
        className="size-6 animate-spin text-muted-foreground"
        aria-label="Loading preview"
      />
    );
  }
  if (query.error) {
    return (
      <p className="p-6 text-sm text-muted-foreground">{query.error.message}</p>
    );
  }

  return (
    <div className="h-full w-full self-stretch overflow-auto text-xs">
      {query.data?.truncated ? <TruncatedBanner /> : null}
      {html ? (
        <div
          className="[&_pre]:!bg-transparent [&_pre]:p-4"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki escapes all input; it emits only its own span markup
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="whitespace-pre-wrap break-words p-4 font-mono">
          {query.data?.text}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Dark-theme override.** Append to `src/app/globals.css` (shiki's dual-theme output uses CSS variables; the app switches themes with a `.dark` class via next-themes):

```css
/* Shiki dual themes: honor the app's class-based dark mode. */
.dark .shiki,
.dark .shiki span {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
  font-style: var(--shiki-dark-font-style) !important;
  font-weight: var(--shiki-dark-font-weight) !important;
}
```

- [ ] **Step 8: Registry** — in `registry.tsx`, change the `code` entry:

```ts
  code: lazy(() => import("./code-viewer"), "CodeViewer"),
```

- [ ] **Step 9: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

```bash
git add src/features/browser src/app/globals.css package.json pnpm-lock.yaml
git commit -m "feat(browser): shiki-highlighted code previews"
```

---

### Task 6: Markdown viewer (rendered ↔ source toggle)

**Files:**
- Create: `src/features/browser/components/viewers/markdown-viewer.tsx`
- Modify: `src/features/browser/components/viewers/registry.tsx` (point `markdown` at it)
- Modify: `src/app/globals.css` (typography plugin)

**Interfaces:**
- Consumes: `browserQueries.textPreview`, `TruncatedBanner`, `CodeViewer` (source mode reuses it), `ViewerProps`.

- [ ] **Step 1: Install dependencies**

Run: `pnpm add react-markdown remark-gfm && pnpm add -D @tailwindcss/typography`
Expected: all three added to `package.json`.

- [ ] **Step 2: Enable the typography plugin.** In `src/app/globals.css`, next to the existing `@import "tailwindcss";` line, add:

```css
@plugin "@tailwindcss/typography";
```

- [ ] **Step 3: The viewer** — `src/features/browser/components/viewers/markdown-viewer.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { browserQueries } from "@/features/browser/api/queries";
import { CodeViewer } from "./code-viewer";
import { TruncatedBanner } from "./text-viewer";
import type { ViewerProps } from "./types";

/**
 * Rendered Markdown (GFM) with a Source toggle. react-markdown ignores raw
 * HTML by default, so bucket content can't inject markup. Links open in a
 * new tab and never carry the opener.
 */
export function MarkdownViewer(props: ViewerProps) {
  const { sourceId, file } = props;
  const [mode, setMode] = useState<"rendered" | "source">("rendered");
  const query = useQuery({
    ...browserQueries.textPreview(sourceId, file.key),
    enabled: file.size > 0,
  });

  if (mode === "source") {
    return (
      <div className="relative h-full w-full">
        <ModeToggle mode={mode} onChange={setMode} />
        <CodeViewer {...props} />
      </div>
    );
  }

  if (file.size === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">This file is empty.</p>
    );
  }
  if (query.isPending) {
    return (
      <Loader2
        className="size-6 animate-spin text-muted-foreground"
        aria-label="Loading preview"
      />
    );
  }
  if (query.error) {
    return (
      <p className="p-6 text-sm text-muted-foreground">{query.error.message}</p>
    );
  }

  return (
    <div className="relative h-full w-full self-stretch overflow-auto">
      <ModeToggle mode={mode} onChange={setMode} />
      {query.data?.truncated ? <TruncatedBanner /> : null}
      <div className="prose prose-sm dark:prose-invert max-w-3xl px-6 py-4">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {query.data?.text ?? ""}
        </Markdown>
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: "rendered" | "source";
  onChange: (mode: "rendered" | "source") => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="absolute top-2 right-2 z-10 bg-background/90 backdrop-blur"
      onClick={() => onChange(mode === "rendered" ? "source" : "rendered")}
    >
      {mode === "rendered" ? "Source" : "Rendered"}
    </Button>
  );
}
```

- [ ] **Step 4: Registry** — in `registry.tsx`:

```ts
  markdown: lazy(() => import("./markdown-viewer"), "MarkdownViewer"),
```

- [ ] **Step 5: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

```bash
git add src/features/browser src/app/globals.css package.json pnpm-lock.yaml
git commit -m "feat(browser): rendered markdown previews with source toggle"
```

---

### Task 7: CSV viewer

**Files:**
- Create: `src/features/browser/lib/csv.ts`
- Create: `src/features/browser/lib/csv.test.ts`
- Create: `src/features/browser/components/viewers/csv-viewer.tsx`
- Modify: `src/features/browser/components/viewers/registry.tsx` (point `csv` at it)

**Interfaces:**
- Produces: `interface CsvPreview { header: string[]; rows: string[][]; truncatedRows: boolean }`, `parseCsvPreview(text: string, maxRows: number): CsvPreview`.

- [ ] **Step 1: Write the failing tests** — `src/features/browser/lib/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCsvPreview } from "./csv";

describe("parseCsvPreview", () => {
  it("splits header and rows", () => {
    const result = parseCsvPreview("a,b,c\n1,2,3\n4,5,6", 100);
    expect(result.header).toEqual(["a", "b", "c"]);
    expect(result.rows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
    expect(result.truncatedRows).toBe(false);
  });

  it("handles quoted fields with commas, newlines and escaped quotes", () => {
    const text = 'name,note\n"Doe, Jane","said ""hi""\nand left"';
    const result = parseCsvPreview(text, 100);
    expect(result.rows).toEqual([["Doe, Jane", 'said "hi"\nand left']]);
  });

  it("handles CRLF and a trailing newline", () => {
    const result = parseCsvPreview("a,b\r\n1,2\r\n", 100);
    expect(result.header).toEqual(["a", "b"]);
    expect(result.rows).toEqual([["1", "2"]]);
  });

  it("caps rows and flags the truncation", () => {
    const result = parseCsvPreview("h\n1\n2\n3\n4", 2);
    expect(result.rows).toEqual([["1"], ["2"]]);
    expect(result.truncatedRows).toBe(true);
  });

  it("empty input → empty preview", () => {
    const result = parseCsvPreview("", 10);
    expect(result.header).toEqual([]);
    expect(result.rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/features/browser/lib/csv.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/features/browser/lib/csv.ts`:

```ts
// Minimal RFC 4180 parser for the CSV preview — quotes, escaped quotes,
// embedded newlines, CRLF. First record is the header; rows are capped so a
// huge (already 1 MiB-truncated) file can't lock the UI up.

export interface CsvPreview {
  header: string[];
  rows: string[][];
  truncatedRows: boolean;
}

export function parseCsvPreview(text: string, maxRows: number): CsvPreview {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  const endField = () => {
    record.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i++) {
    // header + capped rows + 1 so truncation is detectable
    if (records.length > maxRows + 1) break;
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      inQuotes = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n") {
      endRecord();
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || record.length > 0) endRecord();

  const [header = [], ...rows] = records;
  return {
    header,
    rows: rows.slice(0, maxRows),
    truncatedRows: rows.length > maxRows,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/browser/lib/csv.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: The viewer** — `src/features/browser/components/viewers/csv-viewer.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { browserQueries } from "@/features/browser/api/queries";
import { parseCsvPreview } from "@/features/browser/lib/csv";
import { TruncatedBanner } from "./text-viewer";
import type { ViewerProps } from "./types";

/** Rows shown in the preview table — plenty to eyeball a file. */
const CSV_PREVIEW_ROWS = 500;

export function CsvViewer({ sourceId, file }: ViewerProps) {
  const query = useQuery({
    ...browserQueries.textPreview(sourceId, file.key),
    enabled: file.size > 0,
  });

  const preview = useMemo(
    () =>
      query.data?.text
        ? parseCsvPreview(query.data.text, CSV_PREVIEW_ROWS)
        : null,
    [query.data?.text],
  );

  if (file.size === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">This file is empty.</p>
    );
  }
  if (query.isPending) {
    return (
      <Loader2
        className="size-6 animate-spin text-muted-foreground"
        aria-label="Loading preview"
      />
    );
  }
  if (query.error || !preview) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {query.error?.message ?? "Could not load a preview for this file."}
      </p>
    );
  }

  return (
    <div className="h-full w-full self-stretch overflow-auto">
      {query.data?.truncated ? <TruncatedBanner /> : null}
      {preview.truncatedRows ? (
        <p className="border-b bg-muted px-4 py-1.5 text-xs text-muted-foreground">
          Showing the first {CSV_PREVIEW_ROWS} rows.
        </p>
      ) : null}
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-muted">
          <tr>
            {preview.header.map((cell, i) => (
              <th
                // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional, the list never reorders
                key={i}
                className="border-b px-3 py-1.5 text-left font-medium"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, r) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional, the list never reorders
            <tr key={r} className="even:bg-muted/30">
              {row.map((cell, c) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional, the list never reorders
                <td key={c} className="border-b px-3 py-1 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Registry** — in `registry.tsx`:

```ts
  csv: lazy(() => import("./csv-viewer"), "CsvViewer"),
```

- [ ] **Step 7: Final verification and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green, build succeeds.

```bash
git add src/features/browser
git commit -m "feat(browser): csv previews render as a table"
```

Then hand the UI to the user for manual testing (deep-link a `?preview=`, Back button, ←/→ speed, zoom/pan on a large image, a .ts/.yaml file, a README.md toggle, a quoted CSV, video scrubbing on an SFTP source).
