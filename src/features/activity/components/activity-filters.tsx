"use client";

import { Cylinder, ListFilter, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { OPERATION_FILTERS } from "@/features/activity/lib/operation-labels";
import { cn } from "@/lib/utils";

/** URL-backed filters for the activity log: action, source, text search. */
export function ActivityFilters({
  action,
  sourceName,
  q,
  sourceNames,
}: {
  action?: string;
  sourceName?: string;
  q: string;
  sourceNames: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(q);

  const setParam = (name: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  // Debounced search → URL, so the RSC refetches without a submit button.
  useEffect(() => {
    if (search === q) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (search.trim()) {
        params.set("q", search.trim());
      } else {
        params.delete("q");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, q, pathname, router]);

  const hasFilters = Boolean(action || sourceName || q);
  const actionLabel = OPERATION_FILTERS.find((f) => f.id === action)?.label;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search
          className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search target, detail or user"
          aria-label="Search activity"
          className="h-8 pl-8"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8", action && "border-primary/40 text-foreground")}
          >
            <ListFilter aria-hidden />
            {actionLabel ?? "Action"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuRadioGroup
            value={action ?? "all"}
            onValueChange={(value) =>
              setParam("action", value === "all" ? null : value)
            }
          >
            <DropdownMenuRadioItem value="all">
              All actions
            </DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            {OPERATION_FILTERS.map((filter) => (
              <DropdownMenuRadioItem key={filter.id} value={filter.id}>
                {filter.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {sourceNames.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8",
                sourceName && "border-primary/40 text-foreground",
              )}
            >
              <Cylinder aria-hidden />
              {sourceName ?? "Source"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <DropdownMenuRadioGroup
              value={sourceName ?? "all"}
              onValueChange={(value) =>
                setParam("source", value === "all" ? null : value)
              }
            >
              <DropdownMenuRadioItem value="all">
                All sources
              </DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              {sourceNames.map((name) => (
                <DropdownMenuRadioItem key={name} value={name}>
                  {name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={() => {
            setSearch("");
            router.replace(pathname);
          }}
        >
          <X aria-hidden />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
