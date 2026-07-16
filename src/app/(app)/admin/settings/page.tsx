import type { Metadata } from "next";
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

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireAdmin();
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
      <PageHeader
        title="Settings"
        description="Instance-wide options. They apply immediately."
      />
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
