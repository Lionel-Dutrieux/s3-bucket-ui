import type { Metadata } from "next";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { env, oidcEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <SignUpForm oidcLabel={oidcEnabled() ? env.OIDC_PROVIDER_LABEL : null} />
  );
}
