"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListFilter } from "lucide-react";
import { FILE_CATEGORIES, type FileCategory } from "@/features/browser/file-types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function TypeFilter({ active }: { active?: FileCategory }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete("cursor"); // filter change resets pagination
    if (value === "all") {
      params.delete("type");
    } else {
      params.set("type", value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const activeLabel = FILE_CATEGORIES.find((c) => c.id === active)?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-2 text-xs",
            active
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ListFilter className="size-3.5" aria-hidden />
          {activeLabel ?? "Type"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={active ?? "all"} onValueChange={select}>
          <DropdownMenuRadioItem value="all">All types</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {FILE_CATEGORIES.map((category) => (
            <DropdownMenuRadioItem key={category.id} value={category.id}>
              {category.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
