import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { BrandingForm } from "@/features/admin/components/branding-form";
import { SettingsForm } from "@/features/admin/components/settings-form";
import { SmtpSettingsForm } from "@/features/admin/components/smtp-settings-form";
import { SsoProvidersForm } from "@/features/admin/components/sso-providers-form";
import type { SharePolicyValues } from "@/features/admin/lib/schema";
import { requireAdmin } from "@/lib/auth/session";
import { getBranding } from "@/lib/branding/branding";
import { getSmtpConfig, getSmtpProvenance } from "@/lib/config";
import {
  getAuditRetentionDays,
  getSharePolicy,
  getTwoFactorPolicy,
  isOidcOnly,
  isPublicSharingEnabled,
  isPublicSignUpEnabled,
} from "@/lib/dal/settings";
import { listSsoProviders } from "@/lib/dal/sso";
import { env } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settingsPage");
  return { title: t("metaTitle") };
}

export default async function AdminSettingsPage() {
  const session = await requireAdmin();
  const t = await getTranslations("admin.settingsPage");
  const [
    signUpEnabled,
    oidcOnly,
    sharingEnabled,
    sharePolicy,
    twoFactorPolicy,
    auditRetentionDays,
    branding,
    smtp,
    smtpProvenance,
    ssoProviders,
  ] = await Promise.all([
    isPublicSignUpEnabled(),
    isOidcOnly(),
    isPublicSharingEnabled(),
    getSharePolicy(),
    getTwoFactorPolicy(),
    getAuditRetentionDays(),
    getBranding(),
    getSmtpConfig(),
    getSmtpProvenance(),
    listSsoProviders(),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="space-y-6">
        <SettingsForm
          signUpEnabled={signUpEnabled}
          oidcOnly={oidcOnly}
          oidcConfigured={ssoProviders.length > 0}
          sharingEnabled={sharingEnabled}
          sharePolicy={{
            maxExpiryDays: (sharePolicy.maxExpiryDays ??
              0) as SharePolicyValues["maxExpiryDays"],
            requirePassword: sharePolicy.requirePassword,
          }}
          twoFactorPolicy={twoFactorPolicy}
          auditRetentionDays={auditRetentionDays}
        />
        <BrandingForm
          appName={branding.appName}
          primaryColor={branding.primaryColor}
          logoUrl={branding.hasCustomLogo ? branding.logoUrl : null}
        />
        <SmtpSettingsForm
          initial={
            smtp
              ? {
                  host: smtp.host,
                  port: smtp.port,
                  secure: smtp.secure,
                  user: smtp.user,
                  from: smtp.from,
                }
              : null
          }
          hasPassword={smtp?.password != null}
          provenance={smtpProvenance}
          adminEmail={session.user.email}
        />
        <SsoProvidersForm
          providers={ssoProviders}
          callbackBaseUrl={`${env.BETTER_AUTH_URL}/api/auth/sso/callback`}
        />
      </div>
    </>
  );
}
