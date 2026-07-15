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
