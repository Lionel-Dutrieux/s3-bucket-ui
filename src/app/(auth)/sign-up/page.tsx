import { UserRoundX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { isOidcOnly, isPublicSignUpEnabled } from "@/lib/dal/settings";
import { hasAnyUser } from "@/lib/dal/users";
import { env, oidcEnabled } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signUp");
  return { title: t("metaTitle") };
}

export default async function SignUpPage() {
  if (await isOidcOnly()) redirect("/sign-in");

  // Sign-up stays open for the very first account (the admin), then closes
  // unless re-enabled in Admin → Settings. The server hook enforces the same
  // rule — this page is just the honest UI for it.
  const open = !(await hasAnyUser()) || (await isPublicSignUpEnabled());
  if (!open) {
    const t = await getTranslations("auth.signUp");
    return (
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <UserRoundX className="size-5" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("disabledTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("disabledDescription")}
          </p>
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/sign-in">{t("backToSignIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <SignUpForm oidcLabel={oidcEnabled() ? env.OIDC_PROVIDER_LABEL : null} />
  );
}
