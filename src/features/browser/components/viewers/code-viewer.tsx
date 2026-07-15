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
