import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { isOidcOnly } from "@/lib/dal/settings";
import { smtpEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Reset password" };

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
    return (
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <CircleAlert className="size-5" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            This link is no longer valid
          </h1>
          <p className="text-sm text-muted-foreground">
            Reset links expire after one hour and work only once. Request a
            fresh one.
          </p>
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
