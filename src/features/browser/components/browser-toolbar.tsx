"use client";

import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import { Search, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { GridSortMenu } from "@/features/browser/components/menus/grid-sort-menu";
import { TypeFilter } from "@/features/browser/components/menus/type-filter";
import { NewFolderPopover } from "@/features/browser/components/new-folder-popover";
import { ViewToggle } from "@/features/browser/components/view-toggle";
import type { ViewMode } from "@/features/browser/lib/view";

/** Default toolbar (no selection active). One search entry: the input filters
 *  this folder as you type, and Enter (or the inline link) escalates the same
 *  query to the source-wide search. Display controls (type / sort / view) sit
 *  together on the right, separated from the write actions. Owns the hidden
 *  file input backing the Upload button. */
export function BrowserToolbar({
  hasEntries,
  query,
  matchCount,
  onQueryChange,
  view,
  sorting,
  onSortingChange,
  canUpload,
  sourceId,
  prefix,
  onFolderCreated,
  onUploadFiles,
  onSearchSource,
}: {
  hasEntries: boolean;
  query: string;
  matchCount: number;
  onQueryChange: (value: string) => void;
  view: ViewMode;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  canUpload: boolean;
  sourceId: string;
  prefix: string;
  onFolderCreated: () => void;
  onUploadFiles: (files: FileList) => void;
  /** Opens the source-wide search dialog, seeded with the current query. */
  onSearchSource: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const t = useTranslations("browser.toolbar");

  return (
    <div className="flex items-center gap-3">
      {hasEntries ? (
        <>
          <div className="relative w-full max-w-xs">
            <Search
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                // The input filters this folder; Enter widens the same query
                // to the whole source — one field, two scopes.
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSearchSource();
                }
              }}
              placeholder={t("filterPlaceholder")}
              aria-label={t("filterPlaceholder")}
              className="h-8 pl-8"
            />
          </div>
          {query ? (
            <span className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground max-md:hidden">
              <span className="tabular-nums">
                {t("matchCount", { count: matchCount })}
              </span>
              <span aria-hidden>·</span>
              <button
                type="button"
                onClick={onSearchSource}
                className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {t("searchEverywhere")}
                <kbd className="ml-1.5 rounded border bg-muted px-1 font-mono text-[10px]">
                  ↵
                </kbd>
              </button>
            </span>
          ) : null}
        </>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <TypeFilter />
        {view === "grid" && hasEntries ? (
          <GridSortMenu sorting={sorting} onSortingChange={onSortingChange} />
        ) : null}
        <ViewToggle view={view} />
        {canUpload ? (
          <>
            <Separator orientation="vertical" className="mx-1 !h-5" />
            <NewFolderPopover
              sourceId={sourceId}
              prefix={prefix}
              onCreated={onFolderCreated}
            />
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) {
                  onUploadFiles(event.target.files);
                }
                event.target.value = "";
              }}
            />
            <Button
              size="sm"
              className="h-8"
              onClick={() => fileInput.current?.click()}
            >
              <Upload aria-hidden />
              {t("upload")}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
