"use client";

import { Cylinder, HardDrive, History, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  type SidebarUser,
  UserMenu,
} from "@/features/auth/components/user-menu";
import { providerIcon } from "@/features/sources/components/provider-icons";
import { SourceMenu } from "@/features/sources/components/source-menu";
import type { SourceSummary } from "@/lib/dal/sources";
import { getProvider, PROVIDERS } from "@/lib/storage/providers";

export function AppSidebar({
  sources,
  user,
}: {
  sources: SourceSummary[];
  user: SidebarUser;
}) {
  const pathname = usePathname();
  const admin = user.role === "admin";

  // One sidebar group per provider type, in registry order; sources whose
  // provider is no longer registered fall back to a generic group.
  const known = PROVIDERS.map((provider) => ({
    key: provider.id,
    label: provider.label,
    icon: providerIcon(provider.id),
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
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Cylinder className="size-4" aria-hidden />
          </div>
          <div className="grid leading-tight">
            <span className="text-sm font-semibold tracking-tight">
              Bucket UI
            </span>
            <span className="text-xs text-muted-foreground">File manager</span>
          </div>
        </Link>
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
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
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
                      {admin ? (
                        <SourceMenu source={source} isActive={isActive} />
                      ) : null}
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
              {admin ? (
                <p className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  No sources yet — add one from{" "}
                  <Link
                    href="/admin/sources"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Admin → Sources
                  </Link>
                  .
                </p>
              ) : (
                <p className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  No sources available yet. An admin needs to grant you access.
                </p>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="gap-3 p-3">
        {admin ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/activity"}>
                <Link href="/activity">
                  <History className="size-4" aria-hidden />
                  Activity
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith("/admin")}
              >
                <Link href="/admin/users">
                  <Settings2 className="size-4" aria-hidden />
                  Admin
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu user={user} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
