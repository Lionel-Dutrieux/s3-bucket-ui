import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import type { SsoProviderOption } from "@/features/auth/components/sso-button";
import { labelForProvider } from "@/features/auth/lib/provider-label";
import { isSmtpConfigured } from "@/lib/config";
import { isOidcOnly, isPublicSignUpEnabled } from "@/lib/dal/settings";
import { listSsoProviders } from "@/lib/dal/sso";
import { hasAnyUser } from "@/lib/dal/users";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signIn");
  return { title: t("metaTitle") };
}

export default async function SignInPage() {
  const [anyUser, signUpSetting, oidcOnly, providers, smtpConfigured] =
    await Promise.all([
      hasAnyUser(),
      isPublicSignUpEnabled(),
      isOidcOnly(),
      listSsoProviders(),
      isSmtpConfigured(),
    ]);
  const signUpOpen = !anyUser || signUpSetting;
  const ssoProviders: SsoProviderOption[] = providers.map((provider) => ({
    providerId: provider.providerId,
    label: labelForProvider(provider.providerId),
  }));

  return (
    <SignInForm
      ssoProviders={ssoProviders}
      showSignUpLink={signUpOpen && !oidcOnly}
      showForgotLink={smtpConfigured && !oidcOnly}
      oidcOnly={oidcOnly}
    />
  );
}
