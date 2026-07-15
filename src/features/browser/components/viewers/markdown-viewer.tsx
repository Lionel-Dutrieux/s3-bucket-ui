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
    <div className="relative h-full w-full">
      <ModeToggle mode={mode} onChange={setMode} />
      <div className="h-full w-full self-stretch overflow-auto">
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
