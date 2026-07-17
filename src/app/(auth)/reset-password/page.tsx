import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { isOidcOnly } from "@/lib/dal/settings";
import { smtpEnabled } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.resetPassword");
  return { title: t("metaTitle") };
}

interface ResetPasswordPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  if (!smtpEnabled() || (await isOidcOnly())) redirect("/sign-in");

  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : undefined;
  // better-auth redirects here with ?error=INVALID_TOKEN on a bad/used link.
  if (!token || sp.error) {
    const t = await getTranslations("auth.resetPassword");
    return (
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <CircleAlert className="size-5" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("invalidTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("invalidDescription")}
          </p>
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/forgot-password">{t("requestNewLink")}</Link>
        </Button>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
