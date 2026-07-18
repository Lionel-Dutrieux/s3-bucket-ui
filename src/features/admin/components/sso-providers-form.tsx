"use client";

import { Info, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  registerSsoProvider,
  removeSsoProvider,
} from "@/features/admin/actions/sso";
import {
  SSO_PRESETS,
  type SsoPresetId,
  ssoPresetById,
} from "@/features/admin/lib/sso-presets";
import { useAppForm } from "@/forms/form";
import type { SsoProviderRow } from "@/lib/dal/sso";

export function SsoProvidersForm({
  providers,
  callbackBaseUrl,
}: {
  providers: SsoProviderRow[];
  /** `${BETTER_AUTH_URL}/api/auth/sso/callback` — the provider id is appended. */
  callbackBaseUrl: string;
}) {
  const router = useRouter();
  const t = useTranslations("admin.sso");
  const [presetId, setPresetId] = useState<SsoPresetId>("pocket-id");
  const [removing, startRemove] = useTransition();
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const preset = ssoPresetById(presetId);

  const form = useAppForm({
    defaultValues: {
      providerId: "",
      issuer: "",
      clientId: "",
      clientSecret: "",
      domain: "",
      scopes: preset?.scopes ?? "openid profile email",
      groupsClaim: preset?.groupsClaim ?? "groups",
    },
    onSubmit: async ({ value, formApi }) => {
      const result = await registerSsoProvider(value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("added"));
      formApi.reset();
      router.refresh();
    },
  });

  const applyPreset = (id: SsoPresetId) => {
    setPresetId(id);
    const next = ssoPresetById(id);
    if (!next) return;
    form.setFieldValue("scopes", next.scopes);
    form.setFieldValue("groupsClaim", next.groupsClaim);
  };

  const remove = (providerId: string) =>
    startRemove(async () => {
      const result = await removeSsoProvider(providerId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPendingRemoval(null);
      toast.success(t("removed"));
      router.refresh();
    });

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      {/* Registered providers */}
      {providers.length > 0 ? (
        <ul className="space-y-2">
          {providers.map((provider) => (
            <li
              key={provider.id}
              className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-sm">{provider.providerId}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {provider.issuer}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("providerMeta", {
                    domain: provider.domain,
                    claim: provider.groupsClaim,
                  })}
                </p>
                <p className="break-all font-mono text-[11px] text-muted-foreground">
                  {`${callbackBaseUrl}/${provider.providerId}`}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("remove")}
                disabled={removing}
                onClick={() => setPendingRemoval(provider.providerId)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}

      {/* Add a provider */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4 border-t pt-4"
      >
        <p className="text-sm font-medium">{t("addTitle")}</p>

        <div className="space-y-2">
          <Label htmlFor="sso-preset">{t("presetLabel")}</Label>
          <Select
            value={presetId}
            onValueChange={(next) => applyPreset(next as SsoPresetId)}
          >
            <SelectTrigger id="sso-preset" aria-label={t("presetLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SSO_PRESETS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {preset?.helpNoteKey ? (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">{t(preset.helpNoteKey)}</p>
          </div>
        ) : null}

        <form.AppField name="providerId">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="sso-provider-id">{t("providerId")}</Label>
              <Input
                id="sso-provider-id"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                placeholder={preset?.id ?? "pocket-id"}
              />
            </div>
          )}
        </form.AppField>

        <form.AppField name="issuer">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="sso-issuer">{t("issuer")}</Label>
              <Input
                id="sso-issuer"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                placeholder={
                  preset
                    ? t(preset.issuerPlaceholderKey)
                    : "https://idp.example"
                }
              />
            </div>
          )}
        </form.AppField>

        <div className="grid grid-cols-2 gap-4">
          <form.AppField name="clientId">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="sso-client-id">{t("clientId")}</Label>
                <Input
                  id="sso-client-id"
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
                <Label htmlFor="sso-client-secret">{t("clientSecret")}</Label>
                <Input
                  id="sso-client-secret"
                  type="password"
                  autoComplete="new-password"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          </form.AppField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <form.AppField name="domain">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="sso-domain">{t("domain")}</Label>
                <Input
                  id="sso-domain"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="example.com"
                />
              </div>
            )}
          </form.AppField>

          <form.AppField name="groupsClaim">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="sso-groups-claim">{t("groupsClaim")}</Label>
                <Input
                  id="sso-groups-claim"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          </form.AppField>
        </div>

        <form.AppField name="scopes">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="sso-scopes">{t("scopes")}</Label>
              <Input
                id="sso-scopes"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
            </div>
          )}
        </form.AppField>

        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-muted-foreground">{t("verifyBeforeOnly")}</p>
        </div>

        <div className="flex justify-end">
          <form.AppForm>
            <form.SubmitButton pendingLabel={t("addPending")}>
              {t("addProvider")}
            </form.SubmitButton>
          </form.AppForm>
        </div>
      </form>

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open && !removing) setPendingRemoval(null);
        }}
        title={t("removeTitle")}
        description={t("removeConfirm", { provider: pendingRemoval ?? "" })}
        confirmLabel={t("remove")}
        pending={removing}
        destructive
        onConfirm={() => {
          if (pendingRemoval) remove(pendingRemoval);
        }}
      />
    </div>
  );
}
