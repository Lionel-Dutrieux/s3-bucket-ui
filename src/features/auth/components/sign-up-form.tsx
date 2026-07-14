"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signUpSchema } from "@/features/auth/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { authClient } from "@/lib/auth/client";
import { OidcButton } from "./oidc-button";

interface SignUpFormProps {
  /** Label of the OIDC provider button, or null when OIDC is not configured. */
  oidcLabel: string | null;
}

export function SignUpForm({ oidcLabel }: SignUpFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();

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
        setServerError(error.message ?? "Sign up failed.");
        return;
      }
      router.push("/");
      router.refresh();
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          New accounts start without access — an admin grants you sources.
        </p>
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
              label="Name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              autoFocus
            />
          )}
        </form.AppField>
        <form.AppField name="email">
          {(field) => (
            <field.TextField
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
            />
          )}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label="Password"
              type="password"
              autoComplete="new-password"
            />
          )}
        </form.AppField>

        <FormAlert error={serverError} />

        <form.AppForm>
          <form.SubmitButton
            className="w-full"
            pendingLabel="Creating account…"
          >
            Create account
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

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
