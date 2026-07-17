"use client";

import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { authClient } from "@/lib/auth/client";

type Enrollment = { totpURI: string; backupCodes: string[] };

function parseManualKey(totpURI: string): string | null {
  try {
    return new URL(totpURI).searchParams.get("secret");
  } catch {
    return null;
  }
}

export function TwoFactorSetupForm({ enabled }: { enabled: boolean }) {
  const t = useTranslations("twoFactor.setup");
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [enrollment, setEnrollment] = useState<Enrollment>();
  const [serverError, setServerError] = useState<string>();

  // Step 1 — password unlocks enable() and returns the TOTP URI + backup codes.
  const enableForm = useAppForm({
    defaultValues: { password: "" },
    onSubmit: async ({ value, formApi }) => {
      setServerError(undefined);
      const { data, error } = await authClient.twoFactor.enable({
        password: value.password,
      });
      if (error || !data) {
        setServerError(error?.message ?? t("enableError"));
        return;
      }
      setEnrollment({ totpURI: data.totpURI, backupCodes: data.backupCodes });
      formApi.reset();
    },
  });

  // Step 2 — confirm a code from the authenticator to finish enrolling.
  const confirmForm = useAppForm({
    defaultValues: { code: "" },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const { error } = await authClient.twoFactor.verifyTotp({
        code: value.code,
      });
      if (error) {
        setServerError(error.message ?? t("confirmError"));
        return;
      }
      setEnrollment(undefined);
      setIsEnabled(true);
      toast.success(t("enabledToast"));
    },
  });

  // Disable — password required.
  const disableForm = useAppForm({
    defaultValues: { password: "" },
    onSubmit: async ({ value, formApi }) => {
      setServerError(undefined);
      const { error } = await authClient.twoFactor.disable({
        password: value.password,
      });
      if (error) {
        setServerError(error.message ?? t("disableError"));
        return;
      }
      setIsEnabled(false);
      formApi.reset();
      toast.success(t("disabledToast"));
    },
  });

  if (enrollment) {
    const manualKey = parseManualKey(enrollment.totpURI);
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("scanHelp")}</p>
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-white p-4">
          <QRCodeSVG value={enrollment.totpURI} size={160} />
          {manualKey ? (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                {t("manualKeyLabel")}
              </p>
              <p className="break-all font-mono text-sm">{manualKey}</p>
            </div>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{t("backupHelp")}</p>
        <ul className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
          {enrollment.backupCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            confirmForm.handleSubmit();
          }}
          className="space-y-4"
        >
          <confirmForm.AppField name="code">
            {(field) => (
              <field.TextField
                label={t("confirmLabel")}
                autoComplete="one-time-code"
                autoFocus
                mono
              />
            )}
          </confirmForm.AppField>
          <FormAlert error={serverError} />
          <div className="flex justify-end">
            <confirmForm.AppForm>
              <confirmForm.SubmitButton pendingLabel={t("confirmPending")}>
                {t("confirmSubmit")}
              </confirmForm.SubmitButton>
            </confirmForm.AppForm>
          </div>
        </form>
      </div>
    );
  }

  if (isEnabled) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          disableForm.handleSubmit();
        }}
        className="space-y-4"
      >
        <p className="text-sm text-muted-foreground">{t("enabledHelp")}</p>
        <disableForm.AppField name="password">
          {(field) => (
            <field.TextField
              label={t("passwordLabel")}
              type="password"
              autoComplete="current-password"
            />
          )}
        </disableForm.AppField>
        <FormAlert error={serverError} />
        <div className="flex justify-end">
          <disableForm.AppForm>
            <disableForm.SubmitButton pendingLabel={t("disablePending")}>
              {t("disableSubmit")}
            </disableForm.SubmitButton>
          </disableForm.AppForm>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        enableForm.handleSubmit();
      }}
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">{t("disabledHelp")}</p>
      <enableForm.AppField name="password">
        {(field) => (
          <field.TextField
            label={t("passwordLabel")}
            type="password"
            autoComplete="current-password"
          />
        )}
      </enableForm.AppField>
      <FormAlert error={serverError} />
      <div className="flex justify-end">
        <enableForm.AppForm>
          <enableForm.SubmitButton pendingLabel={t("enablePending")}>
            {t("enableSubmit")}
          </enableForm.SubmitButton>
        </enableForm.AppForm>
      </div>
    </form>
  );
}
