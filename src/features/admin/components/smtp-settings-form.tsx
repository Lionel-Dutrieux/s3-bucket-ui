"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  resetSmtpSettings,
  sendTestEmail,
  updateSmtpSettings,
} from "@/features/admin/actions";
import { ProvenanceBadge } from "@/features/admin/components/provenance-badge";
import { useAppForm } from "@/forms/form";
import type { Provenance, SmtpField } from "@/lib/config/resolve";

interface SmtpInitial {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  from: string;
}

export function SmtpSettingsForm({
  initial,
  hasPassword,
  provenance,
  adminEmail,
}: {
  initial: SmtpInitial | null;
  hasPassword: boolean;
  provenance: Record<SmtpField, Provenance>;
  /** Recipient of the test email — the connected admin's own address. */
  adminEmail: string;
}) {
  const router = useRouter();
  const t = useTranslations("admin.runtimeConfig");
  const tCommon = useTranslations("common");
  const [resetting, startReset] = useTransition();
  const [sendingTest, startSendTest] = useTransition();
  const [confirmingReset, setConfirmingReset] = useState(false);

  const form = useAppForm({
    defaultValues: {
      host: initial?.host ?? "",
      port: initial?.port ?? 587,
      secure: initial?.secure ?? true,
      user: initial?.user ?? "",
      // Write-only: always starts blank, never receives the stored secret.
      password: "",
      from: initial?.from ?? "",
    },
    onSubmit: async ({ value }) => {
      const result = await updateSmtpSettings({
        host: value.host,
        port: Number(value.port),
        secure: value.secure,
        user: value.user || null,
        password: value.password === "" ? null : value.password,
        from: value.from,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      form.setFieldValue("password", "");
      toast.success(t("saved"));
      router.refresh();
    },
  });

  const reset = () =>
    startReset(async () => {
      const result = await resetSmtpSettings();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirmingReset(false);
      toast.success(t("saved"));
      router.refresh();
    });

  const sendTest = () =>
    startSendTest(async () => {
      const result = await sendTestEmail();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("smtp.testSent", { email: adminEmail }));
    });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-4 rounded-xl border bg-card p-4 shadow-sm"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("smtp.title")}</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t("smtp.description")}
        </p>
      </div>

      <form.AppField name="host">
        {(field) => (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="smtp-host">{t("smtp.host")}</Label>
              <ProvenanceBadge provenance={provenance.host} />
            </div>
            <Input
              id="smtp-host"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      </form.AppField>

      <div className="grid grid-cols-2 gap-4">
        <form.AppField name="port">
          {(field) => (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="smtp-port">{t("smtp.port")}</Label>
                <ProvenanceBadge provenance={provenance.port} />
              </div>
              <Input
                id="smtp-port"
                type="number"
                min={1}
                max={65535}
                value={field.state.value}
                onChange={(event) =>
                  field.handleChange(Number(event.target.value))
                }
                onBlur={field.handleBlur}
              />
            </div>
          )}
        </form.AppField>

        <form.AppField name="secure">
          {(field) => (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="smtp-secure">{t("smtp.secure")}</Label>
                <ProvenanceBadge provenance={provenance.secure} />
              </div>
              <div className="flex h-8 items-center">
                <Switch
                  id="smtp-secure"
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                  onBlur={field.handleBlur}
                />
              </div>
            </div>
          )}
        </form.AppField>
      </div>

      <form.AppField name="user">
        {(field) => (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="smtp-user">{t("smtp.user")}</Label>
              <ProvenanceBadge provenance={provenance.user} />
            </div>
            <Input
              id="smtp-user"
              autoComplete="off"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      </form.AppField>

      <form.AppField name="password">
        {(field) => (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="smtp-password">{t("smtp.password")}</Label>
              <ProvenanceBadge provenance={provenance.password} />
            </div>
            <Input
              id="smtp-password"
              type="password"
              autoComplete="new-password"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              placeholder={
                hasPassword ? t("smtp.passwordSet") : t("smtp.passwordUnset")
              }
            />
          </div>
        )}
      </form.AppField>

      <form.AppField name="from">
        {(field) => (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="smtp-from">{t("smtp.from")}</Label>
              <ProvenanceBadge provenance={provenance.from} />
            </div>
            <Input
              id="smtp-from"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      </form.AppField>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={resetting}
            onClick={() => setConfirmingReset(true)}
          >
            {t("resetToEnv")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={sendingTest}
            onClick={sendTest}
          >
            {t("smtp.sendTest")}
          </Button>
        </div>
        <form.AppForm>
          <form.SubmitButton pendingLabel={tCommon("save")}>
            {tCommon("save")}
          </form.SubmitButton>
        </form.AppForm>
      </div>

      <ConfirmDialog
        open={confirmingReset}
        onOpenChange={(open) => {
          if (!open && !resetting) setConfirmingReset(false);
        }}
        title={t("resetToEnv")}
        description={t("resetConfirm")}
        confirmLabel={t("resetToEnv")}
        pending={resetting}
        destructive
        onConfirm={reset}
      />
    </form>
  );
}
