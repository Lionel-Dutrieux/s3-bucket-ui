"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { signInSchema } from "@/features/auth/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { authClient } from "@/lib/auth/client";
import { SsoButton, type SsoProviderOption } from "./sso-button";

interface SignInFormProps {
  /** Registered SSO providers, one sign-in button each (empty when none). */
  ssoProviders: SsoProviderOption[];
  /** Whether self-registration is currently open (Admin → Settings). */
  showSignUpLink: boolean;
  /** Whether an SMTP relay is configured (enables "Forgot password?"). */
  showForgotLink: boolean;
  /** SSO-only mode: the email/password form is not rendered at all. */
  oidcOnly: boolean;
}

export function SignInForm({
  ssoProviders,
  showSignUpLink,
  showForgotLink,
  oidcOnly,
}: SignInFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const t = useTranslations("auth.signIn");

  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validators: { onChange: signInSchema },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const { data, error } = await authClient.signIn.email({
        email: value.email,
        password: value.password,
      });
      if (error) {
        setServerError(error.message ?? t("errorFallback"));
        return;
      }
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
        router.push("/two-factor");
        return;
      }
      router.push("/");
      router.refresh();
    },
  });

  // SSO-only instances: no password form, no secondary links — just buttons.
  if (oidcOnly && ssoProviders.length > 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("ssoOnlySubtitle")}
          </p>
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
        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label={t("passwordLabel")}
              type="password"
              autoComplete="current-password"
            />
          )}
        </form.AppField>

        {showForgotLink ? (
          <p className="text-right text-sm">
            <Link
              href="/forgot-password"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("forgotPassword")}
            </Link>
          </p>
        ) : null}

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

      {showSignUpLink ? (
        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link
            href="/sign-up"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("signUpLink")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
