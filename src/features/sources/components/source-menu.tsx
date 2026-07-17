"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuAction } from "@/components/ui/sidebar";
import { useSourceActions } from "@/features/sources/hooks/use-source-actions";
import type { SourceSummary } from "@/lib/dal/sources";

export function SourceMenu({
  source,
  isActive,
}: {
  source: SourceSummary;
  isActive: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("sources");
  const { openEdit, requestRemove, dialogs } = useSourceActions(source, {
    // Removing the source you're currently browsing strands the page.
    onRemoved: () => {
      if (isActive) router.push("/");
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* pointer-coarse: hover never happens on touch — keep it reachable. */}
          <SidebarMenuAction showOnHover className="pointer-coarse:opacity-100">
            <MoreHorizontal aria-hidden />
            <span className="sr-only">{t("menu.optionsAria")}</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onSelect={openEdit}>
            <Pencil aria-hidden />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={requestRemove}>
            <Trash2 aria-hidden />
            {t("remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogs}
    </>
  );
}
