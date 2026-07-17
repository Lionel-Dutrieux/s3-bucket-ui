import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { getOidcConfig, isSmtpConfigured } from "@/lib/config";
import { isOidcOnly, isPublicSignUpEnabled } from "@/lib/dal/settings";
import { hasAnyUser } from "@/lib/dal/users";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signIn");
  return { title: t("metaTitle") };
}

export default async function SignInPage() {
  const [anyUser, signUpSetting, oidcOnly, oidc, smtpConfigured] =
    await Promise.all([
      hasAnyUser(),
      isPublicSignUpEnabled(),
      isOidcOnly(),
      getOidcConfig(),
      isSmtpConfigured(),
    ]);
  const signUpOpen = !anyUser || signUpSetting;

  return (
    <SignInForm
      oidcLabel={oidc ? oidc.providerLabel : null}
      showSignUpLink={signUpOpen && !oidcOnly}
      showForgotLink={smtpConfigured && !oidcOnly}
      oidcOnly={oidcOnly}
    />
  );
}
