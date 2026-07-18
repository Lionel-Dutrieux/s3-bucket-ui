"use client";

import { useStore } from "@tanstack/react-form";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createShareLink } from "@/features/browser/actions/share";
import type { ShareTarget } from "@/features/browser/hooks/use-browser-dialogs";
import { useAppForm } from "@/forms/form";
import { copyText } from "@/lib/clipboard";
import type { ShareExpiry } from "@/lib/shares/expiry";
import { allowedExpiryOptions, type SharePolicy } from "@/lib/shares/policy";

/**
 * Builds the dialog's validation schema from the org policy: the expiry enum is
 * restricted to the options the policy allows, and the password becomes
 * required when the policy mandates one. The server re-checks both regardless.
 */
function makeShareSchema(
  options: readonly { value: ShareExpiry }[],
  requirePassword: boolean,
) {
  const values = options.map((option) => option.value) as [
    ShareExpiry,
    ...ShareExpiry[],
  ];
  return z.object({
    expiresIn: z.enum(values),
    password: requirePassword
      ? z.string().trim().min(1).max(128)
      : z.string().max(128),
    // Kept as a string (the input value); empty means unlimited. Validated as an
    // optional whole number ≥ 1 — zod messages are out of i18n scope by design.
    maxDownloads: z
      .string()
      .refine(
        (value) => value.trim() === "" || /^[1-9]\d*$/.test(value.trim()),
        { message: "Enter a whole number of 1 or more, or leave it empty." },
      ),
  });
}

export function ShareDialog({
  sourceId,
  target,
  policy,
  onOpenChange,
}: {
  sourceId: string;
  /** The file or folder to mint a link for — null keeps the dialog closed. */
  target: ShareTarget | null;
  /** Org-wide constraints — pre-constrains expiry and password inputs. */
  policy?: SharePolicy;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("browser.shareDialog");
  const isPrefix = target?.kind === "prefix";
  // Once minted, the dialog switches to the copy view until closed.
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const maxExpiryDays = policy?.maxExpiryDays ?? null;
  const requirePassword = policy?.requirePassword ?? false;
  const expiryOptions = useMemo(
    () => allowedExpiryOptions(maxExpiryDays),
    [maxExpiryDays],
  );
  // The longest option still allowed under the cap (the plain "7d" default when
  // there is none) — never offer, or default to, a lifetime the policy forbids.
  const defaultExpiry: ShareExpiry = useMemo(() => {
    if (maxExpiryDays === null) return "7d";
    return expiryOptions[expiryOptions.length - 1]?.value ?? "1d";
  }, [maxExpiryDays, expiryOptions]);
  const shareSchema = useMemo(
    () => makeShareSchema(expiryOptions, requirePassword),
    [expiryOptions, requirePassword],
  );

  const form = useAppForm({
    defaultValues: {
      expiresIn: defaultExpiry,
      password: "",
      maxDownloads: "",
    },
    validators: { onChange: shareSchema },
    onSubmit: async ({ value }) => {
      if (!target) return;
      const trimmedMax = value.maxDownloads.trim();
      const result = await createShareLink({
        sourceId,
        key: target.key,
        options: {
          kind: target.kind,
          expiresIn: value.expiresIn,
          password: value.password.trim() || undefined,
          // A folder link is uncapped — the field is hidden for prefixes.
          maxDownloads:
            isPrefix || !trimmedMax ? undefined : Number(trimmedMax),
        },
      });
      if (result.serverError) {
        toast.error(result.serverError);
        return;
      }
      if (!result.data) return;
      setCreatedUrl(`${window.location.origin}/s/${result.data.token}`);
    },
  });
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  const close = (open: boolean) => {
    if (isSubmitting) return;
    if (!open) {
      form.reset();
      setCreatedUrl(null);
      setCopied(false);
    }
    onOpenChange(open);
  };

  const copy = async () => {
    if (!createdUrl) return;
    if (await copyText(createdUrl)) {
      setCopied(true);
      toast.success(t("copiedToast"));
    } else {
      toast.error(t("copyFailedToast"));
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">
            {t(isPrefix ? "titleFolder" : "title", {
              name: target?.name ?? "",
            })}
          </DialogTitle>
          <DialogDescription>
            {t(isPrefix ? "descriptionFolder" : "description")}
          </DialogDescription>
        </DialogHeader>

        {createdUrl ? (
          <div className="flex items-center gap-2">
            <Input readOnly value={createdUrl} className="font-mono text-sm" />
            <Button type="button" variant="outline" size="icon" onClick={copy}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              <span className="sr-only">{t("copyLink")}</span>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.AppField name="expiresIn">
              {(field) => (
                <field.SelectField
                  label={t("expiresLabel")}
                  options={expiryOptions}
                />
              )}
            </form.AppField>
            <form.AppField name="password">
              {(field) => (
                <field.TextField
                  label={
                    requirePassword
                      ? t("passwordRequiredLabel")
                      : t("passwordLabel")
                  }
                  type="password"
                  autoComplete="off"
                  placeholder={
                    requirePassword
                      ? t("passwordRequiredPlaceholder")
                      : t("passwordPlaceholder")
                  }
                />
              )}
            </form.AppField>
            {/* A download cap has no clean meaning across a whole folder —
              hidden for prefix links, which stay uncapped. */}
            {isPrefix ? null : (
              <form.AppField name="maxDownloads">
                {(field) => (
                  <field.TextField
                    label={t("maxDownloadsLabel")}
                    type="number"
                    autoComplete="off"
                    placeholder={t("maxDownloadsPlaceholder")}
                  />
                )}
              </form.AppField>
            )}
            <DialogFooter>
              <form.AppForm>
                <form.SubmitButton pendingLabel={t("creating")}>
                  {t("createLink")}
                </form.SubmitButton>
              </form.AppForm>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
