"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { changePasswordSchema } from "@/features/auth/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { authClient } from "@/lib/auth/client";

export function ChangePasswordForm() {
  const t = useTranslations("account.changePassword");
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
        setServerError(error.message ?? t("changeError"));
        return;
      }
      toast.success(t("changeSuccess"));
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
            label={t("currentPasswordLabel")}
            type="password"
            autoComplete="current-password"
          />
        )}
      </form.AppField>
      <form.AppField name="newPassword">
        {(field) => (
          <field.TextField
            label={t("newPasswordLabel")}
            type="password"
            autoComplete="new-password"
          />
        )}
      </form.AppField>

      <FormAlert error={serverError} />

      <div className="flex justify-end">
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("submitPending")}>
            {t("submit")}
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
