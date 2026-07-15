"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { browserQueries } from "@/features/browser/api/queries";
import { FileIcon } from "@/features/browser/components/file-icon";
import { isPreviewable } from "@/features/browser/lib/preview-kind";
import { formatBytes } from "@/lib/format";

/** Folder prefix an object key lives under — "" at the bucket root. */
function folderOf(key: string): string {
  return key.slice(0, key.lastIndexOf("/") + 1);
}

/**
 * Source-wide search as a command palette (same cmdk kit as Ctrl+K): unlike
 * the toolbar filter (this folder only), it walks the whole bucket
 * server-side. Picking a result lands in the file's folder with the file
 * open in the preview when it has one.
 */
export function SearchCommand({
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

  // Seed from the toolbar filter each time the palette opens.
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

  const openHit = (key: string) => {
    onOpenChange(false);
    const params = new URLSearchParams();
    const prefix = folderOf(key);
    if (prefix) params.set("prefix", prefix);
    // Previewable files open right away; the rest lands in their folder.
    const name = key.slice(key.lastIndexOf("/") + 1);
    if (isPreviewable(name)) params.set("preview", key);
    const search = params.toString();
    router.push(`/source/${sourceId}${search ? `?${search}` : ""}`);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search this source"
      description="Matches file names and paths across every folder"
    >
      {/* Results come filtered from the server — cmdk must not re-filter. */}
      <Command shouldFilter={false}>
        <div className="relative">
          <CommandInput
            value={input}
            onValueChange={setInput}
            placeholder="Search files in this source…"
          />
          {isFetching ? (
            <Loader2Icon
              className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-label="Searching"
            />
          ) : null}
        </div>
        <CommandList>
          {!enabled ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search.
            </p>
          ) : error ? (
            <p
              role="alert"
              className="py-6 text-center text-sm text-destructive"
            >
              {error instanceof Error ? error.message : "Search failed."}
            </p>
          ) : data && data.hits.length === 0 && !isFetching ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing matches &ldquo;{query}&rdquo; in this source.
            </p>
          ) : data ? (
            <CommandGroup
              heading={
                data.truncated
                  ? `First ${data.hits.length} matches — refine to narrow down`
                  : "Files"
              }
            >
              {data.hits.map((hit) => {
                const name = hit.key.slice(hit.key.lastIndexOf("/") + 1);
                const folder = folderOf(hit.key);
                return (
                  <CommandItem
                    key={hit.key}
                    value={hit.key}
                    onSelect={() => openHit(hit.key)}
                  >
                    <FileIcon name={name} className="size-4 shrink-0" />
                    <span className="grid min-w-0 flex-1 leading-tight">
                      <span className="truncate text-sm">{name}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {folder || "/"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatBytes(hit.size)}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Searching…
            </p>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
