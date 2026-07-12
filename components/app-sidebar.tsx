"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cylinder, HardDrive, Plus } from "lucide-react";
import { AddSourceDialog } from "@/features/sources/components/add-source-dialog";
import { SourceMenu } from "@/features/sources/components/source-menu";
import { getProvider, PROVIDERS } from "@/features/sources/providers";
import type { SourceSummary } from "@/lib/dal/sources";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar({ sources }: { sources: SourceSummary[] }) {
  const pathname = usePathname();

  // One sidebar group per provider type, in registry order; sources whose
  // provider is no longer registered fall back to a generic group.
  const known = PROVIDERS.map((provider) => ({
    key: provider.id,
    label: provider.label,
    icon: provider.icon,
    sources: sources.filter((source) => source.provider === provider.id),
  }));
  const orphans = sources.filter((source) => !getProvider(source.provider));
  const groups = [
    ...known,
    { key: "other", label: "Other", icon: HardDrive, sources: orphans },
  ].filter((group) => group.sources.length > 0);

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 p-3">
        <Link href="/" className="flex items-center gap-2.5 px-1 pt-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
            <Cylinder className="size-4" aria-hidden />
          </div>
          <div className="grid leading-tight">
            <span className="text-sm font-semibold tracking-tight">
              Bucket UI
            </span>
            <span className="text-xs text-muted-foreground">File browser</span>
          </div>
        </Link>
        <AddSourceDialog>
          <Button variant="outline" size="sm" className="w-full justify-center">
            <Plus aria-hidden />
            Add source
          </Button>
        </AddSourceDialog>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.key}>
            <SidebarGroupLabel className="gap-1.5">
              <group.icon className="size-3.5" aria-hidden />
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.sources.map((source) => {
                  const isActive = pathname.startsWith(`/source/${source.id}`);
                  return (
                    <SidebarMenuItem key={source.id}>
                      <SidebarMenuButton size="lg" asChild isActive={isActive}>
                        <Link
                          href={`/source/${source.id}`}
                          title={`${source.name} — ${source.bucket}`}
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-amber-600">
                            <group.icon className="size-4" aria-hidden />
                          </div>
                          <div className="grid min-w-0 flex-1 leading-tight">
                            <span className="truncate text-sm font-medium">
                              {source.name}
                            </span>
                            <span className="truncate font-mono text-xs text-muted-foreground">
                              {source.bucket}
                            </span>
                          </div>
                        </Link>
                      </SidebarMenuButton>
                      <SourceMenu source={source} isActive={isActive} />
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        {sources.length === 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Sources</SidebarGroupLabel>
            <SidebarGroupContent>
              <p className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                No sources yet. Connect a storage bucket to start browsing.
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

    </Sidebar>
  );
}
