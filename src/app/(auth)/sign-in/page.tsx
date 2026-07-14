import type { Metadata } from "next";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { isPublicSignUpEnabled } from "@/lib/dal/settings";
import { hasAnyUser } from "@/lib/dal/users";
import { env, oidcEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  const signUpOpen = !(await hasAnyUser()) || (await isPublicSignUpEnabled());

  return (
    <SignInForm
      oidcLabel={oidcEnabled() ? env.OIDC_PROVIDER_LABEL : null}
      showSignUpLink={signUpOpen}
    />
  );
}
