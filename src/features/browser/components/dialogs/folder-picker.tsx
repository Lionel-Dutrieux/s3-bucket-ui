"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Folder, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { browserQueries } from "@/features/browser/api/queries";
import { buildCrumbs } from "@/features/browser/lib/listing";

/**
 * Destination folder browser shared by Copy to… and Move to…: a path bar
 * where every ancestor is one click away, above the subfolder list of the
 * current position.
 */
export function FolderPicker({
  sourceId,
  rootLabel,
  prefix,
  onPrefixChange,
  disabled = false,
}: {
  sourceId: string;
  /** Label of the path bar's root segment — usually the source name. */
  rootLabel: string;
  prefix: string;
  onPrefixChange: (prefix: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("browser.folderPicker");
  const folders = useQuery(browserQueries.folders(sourceId, prefix));

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-2 py-1.5 text-sm">
        <button
          type="button"
          onClick={() => onPrefixChange("")}
          disabled={disabled}
          className={
            prefix === ""
              ? "rounded px-1 font-medium"
              : "rounded px-1 text-muted-foreground hover:text-foreground"
          }
        >
          {rootLabel}
        </button>
        {buildCrumbs(prefix).map((crumb, index, crumbs) => (
          <span key={crumb.prefix} className="flex items-center gap-0.5">
            <ChevronRight
              className="size-3.5 text-muted-foreground"
              aria-hidden
            />
            <button
              type="button"
              onClick={() => onPrefixChange(crumb.prefix)}
              disabled={disabled}
              className={
                index === crumbs.length - 1
                  ? "rounded px-1 font-medium"
                  : "rounded px-1 text-muted-foreground hover:text-foreground"
              }
            >
              {crumb.label}
            </button>
          </span>
        ))}
      </div>

      <div className="max-h-52 overflow-y-auto">
        {folders.isPending ? (
          <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            {t("loadingFolders")}
          </p>
        ) : folders.isError ? (
          <p role="alert" className="px-3 py-4 text-sm text-destructive">
            {folders.error instanceof Error
              ? folders.error.message
              : t("listError")}
          </p>
        ) : folders.data.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            {t("noSubfolders")}
          </p>
        ) : (
          <ul className="divide-y">
            {folders.data.map((folder) => (
              <li key={folder.prefix}>
                <button
                  type="button"
                  onClick={() => onPrefixChange(folder.prefix)}
                  disabled={disabled}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                >
                  <Folder
                    className="size-4 shrink-0 fill-amber-400/80 text-primary"
                    aria-hidden
                  />
                  <span className="truncate">{folder.name}</span>
                  <ChevronRight
                    className="ml-auto size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
