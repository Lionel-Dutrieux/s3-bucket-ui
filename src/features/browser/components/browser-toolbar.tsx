"use client";

import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import { FileSearch, Search, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GridSortMenu } from "@/features/browser/components/menus/grid-sort-menu";
import { NewFolderPopover } from "@/features/browser/components/new-folder-popover";
import type { ViewMode } from "@/features/browser/lib/view";

/** Default toolbar (no selection active): name filter, grid sort menu, and
 *  the write controls when the source allows uploads. Owns the hidden file
 *  input backing the Upload button. */
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
  /** Opens the source-wide search dialog (the input filters this folder only). */
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
              placeholder={t("filterPlaceholder")}
              aria-label={t("filterPlaceholder")}
              className="h-8 pl-8"
            />
          </div>
          {query ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("matchCount", { count: matchCount })}
            </span>
          ) : null}
        </>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={onSearchSource}
        >
          <FileSearch aria-hidden />
          <span className="max-sm:sr-only">{t("searchSource")}</span>
        </Button>
        {view === "grid" && hasEntries ? (
          <GridSortMenu sorting={sorting} onSortingChange={onSortingChange} />
        ) : null}
        {canUpload ? (
          <>
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
