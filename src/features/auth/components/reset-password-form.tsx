"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { resetPasswordSchema } from "@/features/auth/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { authClient } from "@/lib/auth/client";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();

  const form = useAppForm({
    defaultValues: { password: "" },
    validators: { onChange: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const { error } = await authClient.resetPassword({
        newPassword: value.password,
        token,
      });
      if (error) {
        setServerError(
          error.message ??
            "Could not reset the password — the link may have expired.",
        );
        return;
      }
      toast.success("Password updated — sign in with the new one");
      router.push("/sign-in");
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Choose a new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Other devices stay signed in until their session expires.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              autoFocus
            />
          )}
        </form.AppField>

        <FormAlert error={serverError} />

        <form.AppForm>
          <form.SubmitButton className="w-full" pendingLabel="Updating…">
            Update password
          </form.SubmitButton>
        </form.AppForm>
      </form>
    </div>
  );
}
