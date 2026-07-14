import type { Metadata } from "next";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { env, oidcEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <SignInForm oidcLabel={oidcEnabled() ? env.OIDC_PROVIDER_LABEL : null} />
  );
}
