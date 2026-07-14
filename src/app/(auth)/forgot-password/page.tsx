import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { isOidcOnly } from "@/lib/dal/settings";
import { smtpEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  // No SMTP relay → no reset emails; OIDC-only → passwords don't apply.
  if (!smtpEnabled() || (await isOidcOnly())) redirect("/sign-in");

  return <ForgotPasswordForm />;
}
