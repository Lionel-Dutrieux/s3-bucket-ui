"use client";

import type { SortingState } from "@tanstack/react-table";
import { ArrowDownUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const COLUMN_IDS = ["name", "size", "modified"] as const;

/**
 * Sort control for the grid view — the list view sorts via its column
 * headers, the grid has no headers so it gets this dropdown instead. Both
 * drive the same table sorting state.
 */
export function GridSortMenu({
  sorting,
  onSortingChange,
}: {
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
}) {
  const t = useTranslations("browser.sortMenu");
  const columnsT = useTranslations("browser.columns");
  const active = sorting[0];
  const activeColumnId = COLUMN_IDS.find((id) => id === active?.id);
  const activeLabel = activeColumnId ? columnsT(activeColumnId) : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8" title={t("sort")}>
          <ArrowDownUp aria-hidden />
          <span className="max-sm:sr-only">
            {activeLabel ? t("sortColumn", { column: activeLabel }) : t("sort")}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={active?.id ?? ""}
          onValueChange={(id) =>
            onSortingChange([{ id, desc: active?.id === id && active.desc }])
          }
        >
          {COLUMN_IDS.map((id) => (
            <DropdownMenuRadioItem key={id} value={id}>
              {columnsT(id)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {active ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={active.desc ? "desc" : "asc"}
              onValueChange={(direction) =>
                onSortingChange([{ id: active.id, desc: direction === "desc" }])
              }
            >
              <DropdownMenuRadioItem value="asc">
                {t("ascending")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">
                {t("descending")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onSortingChange([])}>
              {t("clearSorting")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
