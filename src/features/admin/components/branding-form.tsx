"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resetBranding,
  updateBranding,
} from "@/features/admin/actions/branding";
import { BRANDING_LOGO_MAX_BYTES } from "@/features/admin/lib/schema";
import { useAppForm } from "@/forms/form";
import { DEFAULT_APP_NAME } from "@/lib/branding/constants";

const ACCEPTED_TYPES = ["image/svg+xml", "image/png", "image/webp"];

export function BrandingForm({
  appName,
  primaryColor,
  logoUrl,
}: {
  appName: string;
  primaryColor: string | null;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [resetting, startReset] = useTransition();
  const t = useTranslations("admin.brandingForm");
  const tErrors = useTranslations("admin.errors");

  const form = useAppForm({
    defaultValues: {
      appName,
      // "" means "stock theme" — mapped to null on submit.
      primaryColor: primaryColor ?? "",
      // undefined → keep current logo, null → remove, string → new data-URL.
      logo: undefined as string | null | undefined,
    },
    onSubmit: async ({ value }) => {
      const result = await updateBranding({
        appName: value.appName,
        primaryColor: value.primaryColor || null,
        logo: value.logo,
      });
      if (result.serverError) {
        toast.error(result.serverError);
        return;
      }
      if (result.validationErrors) {
        toast.error(
          result.validationErrors.formErrors?.[0] ??
            Object.values(result.validationErrors.fieldErrors ?? {})
              .flat()
              .find(Boolean) ??
            tErrors("invalidInput"),
        );
        return;
      }
      // Clear the pending upload so an unrelated later save doesn't
      // re-send the data-URL and needlessly bump the logo version.
      form.setFieldValue("logo", undefined);
      toast.success(t("updatedToast"));
      router.refresh();
    },
  });

  const reset = () =>
    startReset(async () => {
      const result = await resetBranding({});
      if (result.serverError) {
        toast.error(result.serverError);
        return;
      }
      form.reset({
        appName: DEFAULT_APP_NAME,
        primaryColor: "",
        logo: undefined,
      });
      toast.success(t("resetToast"));
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
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <form.AppField name="appName">
        {(field) => (
          <field.TextField
            label={t("appNameLabel")}
            placeholder={DEFAULT_APP_NAME}
          />
        )}
      </form.AppField>

      <form.AppField name="primaryColor">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="branding-color">{t("primaryColorLabel")}</Label>
            <div className="flex items-center gap-2">
              <input
                id="branding-color"
                type="color"
                // The native picker cannot represent "unset" — show the
                // stock amber when no custom color is stored.
                value={field.state.value || "#D97706"}
                onChange={(event) => field.handleChange(event.target.value)}
                className="size-9 cursor-pointer rounded-lg border bg-background p-1"
              />
              <span className="font-mono text-sm text-muted-foreground">
                {field.state.value || t("defaultColor")}
              </span>
              {field.state.value ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => field.handleChange("")}
                >
                  {t("useDefault")}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </form.AppField>

      <form.AppField name="logo">
        {(field) => {
          // undefined = keep whatever is stored server-side.
          const preview =
            field.state.value === undefined ? logoUrl : field.state.value;
          return (
            <div className="space-y-2">
              <Label htmlFor="branding-logo">{t("logoLabel")}</Label>
              <div className="flex items-center gap-3">
                {preview ? (
                  // biome-ignore lint/performance/noImgElement: data-URL preview of the uploaded logo.
                  <img
                    src={preview}
                    alt={t("logoPreviewAlt")}
                    className="max-h-9 max-w-36 rounded border bg-muted/40 object-contain p-1"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t("noLogo")}
                  </span>
                )}
                <Input
                  id="branding-logo"
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  className="max-w-56"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (!ACCEPTED_TYPES.includes(file.type)) {
                      toast.error(t("invalidLogoType"));
                      return;
                    }
                    if (file.size > BRANDING_LOGO_MAX_BYTES) {
                      toast.error(t("logoTooLarge"));
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      field.handleChange(reader.result as string);
                    reader.onerror = () => toast.error(t("logoReadError"));
                    reader.readAsDataURL(file);
                    event.target.value = "";
                  }}
                />
                {preview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => field.handleChange(null)}
                  >
                    {t("removeLogo")}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{t("logoHelp")}</p>
            </div>
          );
        }}
      </form.AppField>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={resetting}
          onClick={reset}
        >
          {t("resetBranding")}
        </Button>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("saving")}>
            {t("saveBranding")}
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
