import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TwoFactorChallengeForm } from "@/features/auth/components/two-factor-challenge-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("twoFactor.challenge");
  return { title: t("metaTitle") };
}

export default async function TwoFactorPage() {
  const t = await getTranslations("twoFactor.challenge");
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <TwoFactorChallengeForm />
    </div>
  );
}
