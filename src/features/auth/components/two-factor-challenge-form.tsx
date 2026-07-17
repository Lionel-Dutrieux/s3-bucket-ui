"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { twoFactorChallengeSchema } from "@/features/auth/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { authClient } from "@/lib/auth/client";

export function TwoFactorChallengeForm() {
  const t = useTranslations("twoFactor.challenge");
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [useBackup, setUseBackup] = useState(false);

  const form = useAppForm({
    defaultValues: { code: "", trustDevice: false },
    validators: { onChange: twoFactorChallengeSchema },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const { error } = useBackup
        ? await authClient.twoFactor.verifyBackupCode({ code: value.code })
        : await authClient.twoFactor.verifyTotp({
            code: value.code,
            trustDevice: value.trustDevice,
          });
      if (error) {
        setServerError(error.message ?? t("error"));
        return;
      }
      router.push("/");
      router.refresh();
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
      <form.AppField name="code">
        {(field) => (
          <field.TextField
            label={useBackup ? t("backupLabel") : t("codeLabel")}
            autoComplete="one-time-code"
            autoFocus
            mono
          />
        )}
      </form.AppField>

      {!useBackup ? (
        <form.AppField name="trustDevice">
          {(field) => (
            <field.SwitchField
              label={t("trustLabel")}
              description={t("trustDescription")}
            />
          )}
        </form.AppField>
      ) : null}

      <FormAlert error={serverError} />

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="link"
          className="px-0"
          onClick={() => setUseBackup((value) => !value)}
        >
          {useBackup ? t("useTotp") : t("useBackup")}
        </Button>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("submitPending")}>
            {t("submit")}
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
