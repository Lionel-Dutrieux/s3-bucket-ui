"use client";

import { useState } from "react";
import { toast } from "sonner";
import { changePasswordSchema } from "@/features/auth/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { authClient } from "@/lib/auth/client";

export function ChangePasswordForm() {
  const [serverError, setServerError] = useState<string>();

  const form = useAppForm({
    defaultValues: { currentPassword: "", newPassword: "" },
    validators: { onChange: changePasswordSchema },
    onSubmit: async ({ value, formApi }) => {
      setServerError(undefined);
      const { error } = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        // Anyone else holding this account's session gets signed out.
        revokeOtherSessions: true,
      });
      if (error) {
        setServerError(error.message ?? "Could not change the password.");
        return;
      }
      toast.success("Password changed — other sessions were signed out");
      formApi.reset();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.AppField name="currentPassword">
        {(field) => (
          <field.TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
          />
        )}
      </form.AppField>
      <form.AppField name="newPassword">
        {(field) => (
          <field.TextField
            label="New password"
            type="password"
            autoComplete="new-password"
          />
        )}
      </form.AppField>

      <FormAlert error={serverError} />

      <div className="flex justify-end">
        <form.AppForm>
          <form.SubmitButton pendingLabel="Changing…">
            Change password
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
