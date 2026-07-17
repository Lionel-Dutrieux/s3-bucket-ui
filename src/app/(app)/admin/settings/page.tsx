import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { BrandingForm } from "@/features/admin/components/branding-form";
import { SettingsForm } from "@/features/admin/components/settings-form";
import { requireAdmin } from "@/lib/auth/session";
import { getBranding } from "@/lib/branding/branding";
import {
  isOidcOnly,
  isPublicSharingEnabled,
  isPublicSignUpEnabled,
} from "@/lib/dal/settings";
import { oidcEnabled } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settingsPage");
  return { title: t("metaTitle") };
}

export default async function AdminSettingsPage() {
  await requireAdmin();
  const t = await getTranslations("admin.settingsPage");
  const [signUpEnabled, oidcOnly, sharingEnabled, branding] = await Promise.all(
    [
      isPublicSignUpEnabled(),
      isOidcOnly(),
      isPublicSharingEnabled(),
      getBranding(),
    ],
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="space-y-6">
        <SettingsForm
          signUpEnabled={signUpEnabled}
          oidcOnly={oidcOnly}
          oidcConfigured={oidcEnabled()}
          sharingEnabled={sharingEnabled}
        />
        <BrandingForm
          appName={branding.appName}
          primaryColor={branding.primaryColor}
          logoUrl={branding.hasCustomLogo ? branding.logoUrl : null}
        />
      </div>
    </>
  );
}
