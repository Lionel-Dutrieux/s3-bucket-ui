"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInSchema } from "@/features/auth/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { authClient } from "@/lib/auth/client";
import { OidcButton } from "./oidc-button";

interface SignInFormProps {
  /** Label of the OIDC provider button, or null when OIDC is not configured. */
  oidcLabel: string | null;
  /** Whether self-registration is currently open (Admin → Settings). */
  showSignUpLink: boolean;
}

export function SignInForm({ oidcLabel, showSignUpLink }: SignInFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();

  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validators: { onChange: signInSchema },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const { error } = await authClient.signIn.email({
        email: value.email,
        password: value.password,
      });
      if (error) {
        setServerError(error.message ?? "Sign in failed.");
        return;
      }
      router.push("/");
      router.refresh();
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back — sign in to browse your sources.
        </p>
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
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              autoFocus
            />
          )}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label="Password"
              type="password"
              autoComplete="current-password"
            />
          )}
        </form.AppField>

        <FormAlert error={serverError} />

        <form.AppForm>
          <form.SubmitButton className="w-full" pendingLabel="Signing in…">
            Sign in
          </form.SubmitButton>
        </form.AppForm>
      </form>

      {oidcLabel ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>
          <OidcButton label={oidcLabel} />
        </>
      ) : null}

      {showSignUpLink ? (
        <p className="text-center text-sm text-muted-foreground">
          No account yet?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      ) : null}
    </div>
  );
}
