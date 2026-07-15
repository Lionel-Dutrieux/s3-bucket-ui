import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/features/admin/components/settings-form";
import { requireAdmin } from "@/lib/auth/session";
import {
  isOidcOnly,
  isPublicSharingEnabled,
  isPublicSignUpEnabled,
} from "@/lib/dal/settings";
import { oidcEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [signUpEnabled, oidcOnly, sharingEnabled] = await Promise.all([
    isPublicSignUpEnabled(),
    isOidcOnly(),
    isPublicSharingEnabled(),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Instance-wide options. They apply immediately."
      />
      <SettingsForm
        signUpEnabled={signUpEnabled}
        oidcOnly={oidcOnly}
        oidcConfigured={oidcEnabled()}
        sharingEnabled={sharingEnabled}
      />
    </>
  );
}
