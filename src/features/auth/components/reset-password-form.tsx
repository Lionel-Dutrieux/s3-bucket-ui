"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { resetPasswordSchema } from "@/features/auth/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { authClient } from "@/lib/auth/client";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const t = useTranslations("auth.resetPassword");

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
        setServerError(error.message ?? t("errorFallback"));
        return;
      }
      toast.success(t("successToast"));
      router.push("/sign-in");
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
        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label={t("newPasswordLabel")}
              type="password"
              autoComplete="new-password"
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
    </div>
  );
}
