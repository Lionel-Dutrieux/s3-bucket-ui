"use client";

import type { SortingState } from "@tanstack/react-table";
import { ArrowDownUp } from "lucide-react";
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

const COLUMNS = [
  { id: "name", label: "Name" },
  { id: "size", label: "Size" },
  { id: "modified", label: "Modified" },
] as const;

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
  const active = sorting[0];
  const activeLabel = COLUMNS.find((c) => c.id === active?.id)?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <ArrowDownUp aria-hidden />
          {activeLabel ? `Sort: ${activeLabel}` : "Sort"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={active?.id ?? ""}
          onValueChange={(id) =>
            onSortingChange([{ id, desc: active?.id === id && active.desc }])
          }
        >
          {COLUMNS.map((column) => (
            <DropdownMenuRadioItem key={column.id} value={column.id}>
              {column.label}
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
                Ascending
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">
                Descending
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onSortingChange([])}>
              Clear sorting
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
