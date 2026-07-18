import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { BrandingForm } from "@/features/admin/components/branding-form";
import { OidcSettingsForm } from "@/features/admin/components/oidc-settings-form";
import { SettingsForm } from "@/features/admin/components/settings-form";
import { SmtpSettingsForm } from "@/features/admin/components/smtp-settings-form";
import type { SharePolicyValues } from "@/features/admin/lib/schema";
import { requireAdmin } from "@/lib/auth/session";
import { getBranding } from "@/lib/branding/branding";
import {
  getOidcConfig,
  getOidcProvenance,
  getSmtpConfig,
  getSmtpProvenance,
} from "@/lib/config";
import {
  getAuditRetentionDays,
  getSharePolicy,
  getTwoFactorPolicy,
  isOidcOnly,
  isPublicSharingEnabled,
  isPublicSignUpEnabled,
} from "@/lib/dal/settings";
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
    oidc,
    smtpProvenance,
    oidcProvenance,
  ] = await Promise.all([
    isPublicSignUpEnabled(),
    isOidcOnly(),
    isPublicSharingEnabled(),
    getSharePolicy(),
    getTwoFactorPolicy(),
    getAuditRetentionDays(),
    getBranding(),
    getSmtpConfig(),
    getOidcConfig(),
    getSmtpProvenance(),
    getOidcProvenance(),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="space-y-6">
        <SettingsForm
          signUpEnabled={signUpEnabled}
          oidcOnly={oidcOnly}
          oidcConfigured={oidc !== null}
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
        <OidcSettingsForm
          initial={
            oidc
              ? {
                  discoveryUrl: oidc.discoveryUrl,
                  clientId: oidc.clientId,
                  providerLabel: oidc.providerLabel,
                  scopes: oidc.scopes,
                  groupsClaim: oidc.groupsClaim,
                }
              : null
          }
          hasSecret={oidc !== null}
          provenance={oidcProvenance}
          callbackUrl={`${env.BETTER_AUTH_URL}/api/auth/oauth2/callback/oidc`}
        />
      </div>
    </>
  );
}
