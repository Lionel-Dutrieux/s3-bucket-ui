"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
          <SidebarMenuAction showOnHover>
            <MoreHorizontal aria-hidden />
            <span className="sr-only">Source options</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onSelect={openEdit}>
            <Pencil aria-hidden />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={requestRemove}>
            <Trash2 aria-hidden />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogs}
    </>
  );
}
