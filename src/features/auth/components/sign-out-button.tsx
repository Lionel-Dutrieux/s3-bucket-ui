"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

/** Standalone sign-out control — same flow as the sidebar user menu. */
export function SignOutButton() {
  const router = useRouter();
  const t = useTranslations("auth");

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>
      <LogOut aria-hidden />
      {t("userMenu.signOut")}
    </Button>
  );
}
