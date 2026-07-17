"use client";

import {
  Check,
  ChevronsUpDown,
  Languages,
  LogOut,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { setLocale } from "@/features/auth/actions";
import type { Locale } from "@/i18n/config";
import { authClient } from "@/lib/auth/client";

export interface SidebarUser {
  name: string;
  email: string;
  role: string;
}

const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
];

export function UserMenu({ user }: { user: SidebarUser }) {
  const router = useRouter();
  const t = useTranslations("auth");
  const locale = useLocale();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  const handleLocaleChange = async (value: Locale) => {
    await setLocale({ locale: value });
    router.refresh();
  };

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-xs font-semibold">
            {initials || "?"}
          </div>
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-medium">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
          <ChevronsUpDown
            className="size-4 text-muted-foreground"
            aria-hidden
          />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          {user.role === "admin" ? (
            <>
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              {t("userMenu.administrator")}
            </>
          ) : (
            t("userMenu.member")
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRoundCog aria-hidden />
            {t("userMenu.account")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages aria-hidden />
            {t("userMenu.language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {LOCALE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => handleLocaleChange(option.value)}
              >
                <Check
                  className={
                    option.value === locale ? "opacity-100" : "opacity-0"
                  }
                  aria-hidden
                />
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut aria-hidden />
          {t("userMenu.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
