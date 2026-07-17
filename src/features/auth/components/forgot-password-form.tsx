"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { forgotPasswordSchema } from "@/features/auth/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { authClient } from "@/lib/auth/client";

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string>();
  const [sent, setSent] = useState(false);
  const t = useTranslations("auth.forgotPassword");

  const form = useAppForm({
    defaultValues: { email: "" },
    validators: { onChange: forgotPasswordSchema },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const { error } = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: "/reset-password",
      });
      if (error) {
        setServerError(error.message ?? t("errorFallback"));
        return;
      }
      setSent(true);
    },
  });

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <MailCheck className="size-5" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("sentTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("sentDescription")}
          </p>
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/sign-in">{t("backToSignIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.AppField name="email">
          {(field) => (
            <field.TextField
              label={t("emailLabel")}
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              autoFocus
            />
          )}
        </form.AppField>

        <FormAlert error={serverError} />

        <form.AppForm>
          <form.SubmitButton
            className="w-full"
            pendingLabel={t("submitPending")}
          >
            {t("submit")}
          </form.SubmitButton>
        </form.AppForm>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("remembered")}{" "}
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("signInLink")}
        </Link>
      </p>
    </div>
  );
}
