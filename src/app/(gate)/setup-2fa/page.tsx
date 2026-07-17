import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { TwoFactorSetupForm } from "@/features/auth/components/two-factor-setup-form";
import { requireSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("twoFactor.gate");
  return { title: t("metaTitle") };
}

export default async function SetupTwoFactorPage() {
  const session = await requireSession();
  // Already enrolled — nothing to do here.
  if (session.user.twoFactorEnabled === true) redirect("/");

  const t = await getTranslations("twoFactor.gate");

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("heading")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <TwoFactorSetupForm enabled={false} redirectOnEnabled="/" />
      <div className="flex justify-center border-t pt-4">
        <SignOutButton />
      </div>
    </div>
  );
}
