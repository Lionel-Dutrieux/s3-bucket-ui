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
  indicator,
}: {
  source: SourceSummary;
  isActive: boolean;
  /** Idle content of the action slot (e.g. the health dot); the "…" icon
      takes its place on hover/focus/open. */
  indicator?: React.ReactNode;
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
          {indicator ? (
            /* Always-visible trigger: shows the indicator at rest, swaps to
               "…" on hover/focus/open. On touch (no hover) "…" stays visible
               so the menu remains reachable. */
            <SidebarMenuAction className="group/action">
              <span
                aria-hidden
                className="absolute inset-0 grid place-items-center transition-opacity group-hover/menu-item:opacity-0 group-focus-within/menu-item:opacity-0 group-aria-expanded/action:opacity-0 pointer-coarse:opacity-0"
              >
                {indicator}
              </span>
              <MoreHorizontal
                aria-hidden
                className="opacity-0 transition-opacity group-hover/menu-item:opacity-100 group-focus-within/menu-item:opacity-100 group-aria-expanded/action:opacity-100 pointer-coarse:opacity-100"
              />
              <span className="sr-only">{t("menu.optionsAria")}</span>
            </SidebarMenuAction>
          ) : (
            /* pointer-coarse: hover never happens on touch — keep it reachable. */
            <SidebarMenuAction
              showOnHover
              className="pointer-coarse:opacity-100"
            >
              <MoreHorizontal aria-hidden />
              <span className="sr-only">{t("menu.optionsAria")}</span>
            </SidebarMenuAction>
          )}
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
