import type { Metadata } from "next";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { isOidcOnly, isPublicSignUpEnabled } from "@/lib/dal/settings";
import { hasAnyUser } from "@/lib/dal/users";
import { env, oidcEnabled, smtpEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

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
