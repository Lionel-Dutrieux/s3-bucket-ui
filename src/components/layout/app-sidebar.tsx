"use client";

import { HardDrive, History, Link2, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { type BrandingInfo, BrandMark } from "@/components/layout/brand-mark";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/layout/command-palette";
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
import { ProviderPlate } from "@/features/sources/components/provider-logos";
import { SourceHealthDot } from "@/features/sources/components/source-health-dot";
import { SourceMenu } from "@/features/sources/components/source-menu";
import type { SourceSummary } from "@/lib/dal/sources";
import { getProvider, PROVIDERS } from "@/lib/storage/providers";
import { cn } from "@/lib/utils";

export function AppSidebar({
  branding,
  sources,
  user,
}: {
  branding: BrandingInfo;
  sources: SourceSummary[];
  user: SidebarUser;
}) {
  const pathname = usePathname();
  const admin = user.role === "admin";
  const t = useTranslations("layout.sidebar");
  // ⌘ only exists on Apple keyboards; everywhere else the palette opens with
  // Ctrl+K. The server can't know the platform, so the hint mounts client-side.
  const [shortcutHint, setShortcutHint] = useState<string | null>(null);
  useEffect(() => {
    setShortcutHint(
      /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘K" : "Ctrl K",
    );
  }, []);

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
    {
      key: "other",
      label: t("otherGroup"),
      icon: HardDrive,
      sources: orphans,
    },
  ].filter((group) => group.sources.length > 0);

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 p-3">
        <Link href="/" className="flex items-center px-1 pt-1">
          <BrandMark branding={branding} />
        </Link>
        {/* Visible doorway to the Ctrl/Cmd+K palette — the shortcut alone
            is undiscoverable. */}
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))
          }
          className="flex h-8 w-full items-center gap-2 rounded-lg border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Search className="size-3.5" aria-hidden />
          <span className="flex-1 text-left">{t("search")}</span>
          {shortcutHint ? (
            <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
              {shortcutHint}
            </kbd>
          ) : null}
        </button>
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
                          className={admin ? undefined : "pe-7"}
                        >
                          <ProviderPlate
                            providerId={source.provider}
                            className="size-8"
                          />
                          <div className="grid min-w-0 flex-1 leading-tight">
                            <span className="truncate text-sm font-medium">
                              {source.name}
                            </span>
                            {/* The bucket only helps when it differs from
                                the display name. */}
                            {source.bucket !== source.name ? (
                              <span className="truncate text-xs text-muted-foreground">
                                {source.bucket}
                              </span>
                            ) : null}
                          </div>
                        </Link>
                      </SidebarMenuButton>
                      {/* The dot lives in the action slot, right-aligned; for
                          admins the hover "…" menu takes its place (mirror of
                          SidebarMenuAction's showOnHover visibility). */}
                      <span
                        className={cn(
                          "pointer-events-none absolute top-1/2 right-[11px] -translate-y-1/2",
                          admin &&
                            "transition-opacity max-md:opacity-0 pointer-coarse:opacity-0 group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0",
                        )}
                      >
                        <SourceHealthDot sourceId={source.id} />
                      </span>
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
            <SidebarGroupLabel>{t("sourcesGroup")}</SidebarGroupLabel>
            <SidebarGroupContent>
              {admin ? (
                <p className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  {t.rich("noSourcesAdmin", {
                    link: (chunks) => (
                      <Link
                        href="/admin/sources"
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
              ) : (
                <p className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  {t("noSourcesUser")}
                </p>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="gap-3 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/shares"}>
              <Link href="/shares">
                <Link2 className="size-4" aria-hidden />
                {t("sharedLinks")}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {admin ? (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/activity"}>
                  <Link href="/activity">
                    <History className="size-4" aria-hidden />
                    {t("activity")}
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
                    {t("admin")}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : null}
        </SidebarMenu>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t("theme")}</span>
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
