import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { isOidcOnly, isPublicSignUpEnabled } from "@/lib/dal/settings";
import { hasAnyUser } from "@/lib/dal/users";
import { env, oidcEnabled, smtpEnabled } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signIn");
  return { title: t("metaTitle") };
}

export default async function SignInPage() {
  const [anyUser, signUpSetting, oidcOnly] = await Promise.all([
    hasAnyUser(),
    isPublicSignUpEnabled(),
    isOidcOnly(),
  ]);
  const signUpOpen = !anyUser || signUpSetting;

  return (
    <SignInForm
      oidcLabel={oidcEnabled() ? env.OIDC_PROVIDER_LABEL : null}
      showSignUpLink={signUpOpen && !oidcOnly}
      showForgotLink={smtpEnabled() && !oidcOnly}
      oidcOnly={oidcOnly}
    />
  );
}
