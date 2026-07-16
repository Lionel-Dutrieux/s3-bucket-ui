"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetBranding, updateBranding } from "@/features/admin/actions";
import { BRANDING_LOGO_MAX_BYTES } from "@/features/admin/lib/schema";
import { useAppForm } from "@/forms/form";

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
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Branding updated");
      router.refresh();
    },
  });

  const reset = () =>
    startReset(async () => {
      const result = await resetBranding();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      form.reset({ appName: "Bucket UI", primaryColor: "", logo: undefined });
      toast.success("Branding reset to defaults");
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
        <p className="text-sm font-medium">White labelling</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          Rebrand this instance: the name, logo and primary color apply to the
          sidebar, the sign-in page, public share pages and the browser tab.
        </p>
      </div>

      <form.AppField name="appName">
        {(field) => (
          <field.TextField label="Application name" placeholder="Bucket UI" />
        )}
      </form.AppField>

      <form.AppField name="primaryColor">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="branding-color">Primary color</Label>
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
                {field.state.value || "Default (amber)"}
              </span>
              {field.state.value ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => field.handleChange("")}
                >
                  Use default
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
              <Label htmlFor="branding-logo">Custom logo</Label>
              <div className="flex items-center gap-3">
                {preview ? (
                  // biome-ignore lint/performance/noImgElement: data-URL preview of the uploaded logo.
                  <img
                    src={preview}
                    alt="Logo preview"
                    className="max-h-9 max-w-36 rounded border bg-muted/40 object-contain p-1"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    None — the app name is shown instead.
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
                      toast.error("Use an SVG, PNG or WebP image.");
                      return;
                    }
                    if (file.size > BRANDING_LOGO_MAX_BYTES) {
                      toast.error("The logo must be 512 KB or smaller.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      field.handleChange(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                />
                {preview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => field.handleChange(null)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                SVG, PNG or WebP, 512 KB max. Replaces the app name in the
                sidebar — a horizontal mark with the company name works best.
              </p>
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
          Reset branding
        </Button>
        <form.AppForm>
          <form.SubmitButton pendingLabel="Saving…">
            Save branding
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
