"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { signUpSchema } from "@/features/auth/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { authClient } from "@/lib/auth/client";
import { SsoButton, type SsoProviderOption } from "./sso-button";

interface SignUpFormProps {
  /** Registered SSO providers, one sign-in button each (empty when none). */
  ssoProviders: SsoProviderOption[];
}

export function SignUpForm({ ssoProviders }: SignUpFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const t = useTranslations("auth.signUp");

  const form = useAppForm({
    defaultValues: { name: "", email: "", password: "" },
    validators: { onChange: signUpSchema },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      // Only name/email/password — the role is assigned server-side (the
      // first account ever created becomes admin, everyone else is a user).
      const { error } = await authClient.signUp.email({
        name: value.name,
        email: value.email,
        password: value.password,
      });
      if (error) {
        setServerError(error.message ?? t("errorFallback"));
        return;
      }
      router.push("/");
      router.refresh();
    },
  });

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
        <form.AppField name="name">
          {(field) => (
            <field.TextField
              label={t("nameLabel")}
              autoComplete="name"
              placeholder={t("namePlaceholder")}
              autoFocus
            />
          )}
        </form.AppField>
        <form.AppField name="email">
          {(field) => (
            <field.TextField
              label={t("emailLabel")}
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
            />
          )}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label={t("passwordLabel")}
              type="password"
              autoComplete="new-password"
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

      {ssoProviders.length > 0 ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {t("or")}
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            {ssoProviders.map((provider) => (
              <SsoButton
                key={provider.providerId}
                providerId={provider.providerId}
                label={provider.label}
              />
            ))}
          </div>
        </>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
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
