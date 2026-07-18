"use client";

import { ListFilter } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FILE_CATEGORIES } from "@/features/browser/lib/file-types";
import { cn } from "@/lib/utils";

export function TypeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("browser.fileTypes");
  // Self-contained: the active category lives in the URL (?type=), so the
  // control can sit anywhere without threading server state down to it.
  const active = FILE_CATEGORIES.find(
    (category) => category.id === searchParams.get("type"),
  )?.id;

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

  const activeLabel = active ? t(active) : undefined;

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
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ListFilter className="size-3.5" aria-hidden />
          {activeLabel ?? t("type")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={active ?? "all"} onValueChange={select}>
          <DropdownMenuRadioItem value="all">
            {t("allTypes")}
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {FILE_CATEGORIES.map((category) => (
            <DropdownMenuRadioItem key={category.id} value={category.id}>
              {t(category.id)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
