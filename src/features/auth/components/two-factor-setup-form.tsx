"use client";

import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

function BackupCodesList({ codes }: { codes: string[] }) {
  return (
    <ul className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
      {codes.map((code) => (
        <li key={code}>{code}</li>
      ))}
    </ul>
  );
}

function CopyCodesButton({
  codes,
  label,
  copiedToast,
  errorToast,
}: {
  codes: string[];
  label: string;
  copiedToast: string;
  errorToast: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(codes.join("\n"));
          toast.success(copiedToast);
        } catch {
          toast.error(errorToast);
        }
      }}
    >
      {label}
    </Button>
  );
}

export function TwoFactorSetupForm({ enabled }: { enabled: boolean }) {
  const t = useTranslations("twoFactor.setup");
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [enrollment, setEnrollment] = useState<Enrollment>();
  const [serverError, setServerError] = useState<string>();
  const [regeneratedCodes, setRegeneratedCodes] = useState<string[]>();
  const [regenerateError, setRegenerateError] = useState<string>();

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

  // Regenerate — password required; invalidates the previous set of codes.
  const regenerateForm = useAppForm({
    defaultValues: { password: "" },
    onSubmit: async ({ value, formApi }) => {
      setRegenerateError(undefined);
      const { data, error } = await authClient.twoFactor.generateBackupCodes({
        password: value.password,
      });
      if (error || !data) {
        setRegenerateError(error?.message ?? t("regenerateError"));
        return;
      }
      setRegeneratedCodes(data.backupCodes);
      formApi.reset();
      toast.success(t("regeneratedToast"));
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
        <BackupCodesList codes={enrollment.backupCodes} />
        <CopyCodesButton
          codes={enrollment.backupCodes}
          label={t("copyCodes")}
          copiedToast={t("codesCopiedToast")}
          errorToast={t("copyError")}
        />
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
      <div className="space-y-6">
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

        <div className="space-y-4 border-t pt-6">
          <h3 className="text-sm font-medium">{t("regenerateHeading")}</h3>
          <p className="text-sm text-muted-foreground">{t("regenerateHelp")}</p>
          {regeneratedCodes ? (
            <>
              <BackupCodesList codes={regeneratedCodes} />
              <CopyCodesButton
                codes={regeneratedCodes}
                label={t("copyCodes")}
                copiedToast={t("codesCopiedToast")}
                errorToast={t("copyError")}
              />
            </>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              regenerateForm.handleSubmit();
            }}
            className="space-y-4"
          >
            <regenerateForm.AppField name="password">
              {(field) => (
                <field.TextField
                  label={t("passwordLabel")}
                  type="password"
                  autoComplete="current-password"
                />
              )}
            </regenerateForm.AppField>
            <FormAlert error={regenerateError} />
            <div className="flex justify-end">
              <regenerateForm.AppForm>
                <regenerateForm.SubmitButton
                  pendingLabel={t("regeneratePending")}
                >
                  {t("regenerateSubmit")}
                </regenerateForm.SubmitButton>
              </regenerateForm.AppForm>
            </div>
          </form>
        </div>
      </div>
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
