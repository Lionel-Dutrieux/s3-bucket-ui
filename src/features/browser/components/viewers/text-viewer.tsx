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
