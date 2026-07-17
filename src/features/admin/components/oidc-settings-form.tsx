"use client";

import { Info, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resetOidcSettings,
  updateOidcSettings,
} from "@/features/admin/actions";
import { ProvenanceBadge } from "@/features/admin/components/provenance-badge";
import { useAppForm } from "@/forms/form";
import type { OidcField, Provenance } from "@/lib/config/resolve";

interface OidcInitial {
  discoveryUrl: string;
  clientId: string;
  providerLabel: string;
  scopes: string;
  groupsClaim: string;
}

export function OidcSettingsForm({
  initial,
  hasSecret,
  provenance,
  callbackUrl,
}: {
  initial: OidcInitial | null;
  hasSecret: boolean;
  provenance: Record<OidcField, Provenance>;
  callbackUrl: string;
}) {
  const router = useRouter();
  const t = useTranslations("admin.runtimeConfig");
  const tCommon = useTranslations("common");
  const [resetting, startReset] = useTransition();
  const [confirmingReset, setConfirmingReset] = useState(false);

  const form = useAppForm({
    defaultValues: {
      discoveryUrl: initial?.discoveryUrl ?? "",
      clientId: initial?.clientId ?? "",
      // Write-only: always starts blank, never receives the stored secret.
      clientSecret: "",
      providerLabel: initial?.providerLabel ?? "",
      scopes: initial?.scopes ?? "",
      groupsClaim: initial?.groupsClaim ?? "",
    },
    onSubmit: async ({ value }) => {
      const result = await updateOidcSettings({
        discoveryUrl: value.discoveryUrl,
        clientId: value.clientId,
        clientSecret: value.clientSecret === "" ? null : value.clientSecret,
        providerLabel: value.providerLabel,
        scopes: value.scopes,
        groupsClaim: value.groupsClaim,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      form.setFieldValue("clientSecret", "");
      toast.success(t("saved"));
      router.refresh();
    },
  });

  const reset = () =>
    startReset(async () => {
      const result = await resetOidcSettings();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirmingReset(false);
      toast.success(t("saved"));
      router.refresh();
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
        <p className="text-sm font-medium">{t("oidc.title")}</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t("oidc.description")}
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-muted-foreground">{t("oidc.callbackInfo")}</p>
          <p className="break-all font-mono text-xs">{callbackUrl}</p>
        </div>
      </div>

      <form.AppField name="discoveryUrl">
        {(field) => (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="oidc-discovery-url">
                {t("oidc.discoveryUrl")}
              </Label>
              <ProvenanceBadge provenance={provenance.discoveryUrl} />
            </div>
            <Input
              id="oidc-discovery-url"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      </form.AppField>

      <form.AppField name="clientId">
        {(field) => (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="oidc-client-id">{t("oidc.clientId")}</Label>
              <ProvenanceBadge provenance={provenance.clientId} />
            </div>
            <Input
              id="oidc-client-id"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      </form.AppField>

      <form.AppField name="clientSecret">
        {(field) => (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="oidc-client-secret">
                {t("oidc.clientSecret")}
              </Label>
              <ProvenanceBadge provenance={provenance.clientSecret} />
            </div>
            <Input
              id="oidc-client-secret"
              type="password"
              autoComplete="new-password"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              placeholder={
                hasSecret ? t("oidc.secretSet") : t("oidc.secretUnset")
              }
            />
          </div>
        )}
      </form.AppField>

      <form.AppField name="providerLabel">
        {(field) => (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="oidc-provider-label">
                {t("oidc.providerLabel")}
              </Label>
              <ProvenanceBadge provenance={provenance.providerLabel} />
            </div>
            <Input
              id="oidc-provider-label"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      </form.AppField>

      <div className="grid grid-cols-2 gap-4">
        <form.AppField name="scopes">
          {(field) => (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="oidc-scopes">{t("oidc.scopes")}</Label>
                <ProvenanceBadge provenance={provenance.scopes} />
              </div>
              <Input
                id="oidc-scopes"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
            </div>
          )}
        </form.AppField>

        <form.AppField name="groupsClaim">
          {(field) => (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="oidc-groups-claim">
                  {t("oidc.groupsClaim")}
                </Label>
                <ProvenanceBadge provenance={provenance.groupsClaim} />
              </div>
              <Input
                id="oidc-groups-claim"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
            </div>
          )}
        </form.AppField>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <p>{t("oidc.lockoutWarning")}</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={resetting}
          onClick={() => setConfirmingReset(true)}
        >
          {t("resetToEnv")}
        </Button>
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
