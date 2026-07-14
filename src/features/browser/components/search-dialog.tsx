"use client";

import { useQuery } from "@tanstack/react-query";
import { FileSearch, Loader2Icon, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { browserQueries } from "@/features/browser/api/queries";
import { FileIcon } from "@/features/browser/components/file-icon";
import { formatBytes } from "@/lib/format";

/** Folder prefix an object key lives under — "" at the bucket root. */
function folderOf(key: string): string {
  return key.slice(0, key.lastIndexOf("/") + 1);
}

/**
 * Source-wide search: unlike the toolbar filter (this folder only), it walks
 * the whole bucket server-side. A result row navigates to the file's folder.
 */
export function SearchDialog({
  sourceId,
  open,
  onOpenChange,
  initialQuery = "",
}: {
  sourceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);

  // Seed from the toolbar filter each time the dialog opens.
  useEffect(() => {
    if (open) {
      setInput(initialQuery);
      setQuery(initialQuery);
    }
  }, [open, initialQuery]);

  // Debounce typing → one search per pause, not per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const enabled = open && query.length >= 2;
  const { data, isFetching, error } = useQuery({
    ...browserQueries.search(sourceId, query),
    enabled,
  });

  const openFolder = (key: string) => {
    const prefix = folderOf(key);
    onOpenChange(false);
    router.push(
      prefix
        ? `/source/${sourceId}?prefix=${encodeURIComponent(prefix)}`
        : `/source/${sourceId}`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Search this source</DialogTitle>
          <DialogDescription>
            Matches file names and paths across every folder.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          {isFetching ? (
            <Loader2Icon
              className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-label="Searching"
            />
          ) : null}
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search files…"
            aria-label="Search this source"
            className="pl-8"
            autoFocus
          />
        </div>

        {!enabled ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search.
          </p>
        ) : error ? (
          <p role="alert" className="py-6 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Search failed."}
          </p>
        ) : data && data.hits.length === 0 && !isFetching ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <FileSearch className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Nothing matches &ldquo;{query}&rdquo; in this source.
            </p>
          </div>
        ) : data ? (
          <>
            <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border">
              {data.hits.map((hit) => {
                const name = hit.key.slice(hit.key.lastIndexOf("/") + 1);
                const folder = folderOf(hit.key);
                return (
                  <li key={hit.key}>
                    <button
                      type="button"
                      onClick={() => openFolder(hit.key)}
                      title={`Open the folder of ${hit.key}`}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <FileIcon name={name} className="size-4 shrink-0" />
                      <span className="grid min-w-0 flex-1 leading-tight">
                        <span className="truncate text-sm">{name}</span>
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {folder || "/"}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {formatBytes(hit.size)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {data.truncated ? (
              <p className="text-xs text-muted-foreground">
                Showing the first {data.hits.length} matches — refine the search
                to narrow it down.
              </p>
            ) : null}
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Searching…
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
