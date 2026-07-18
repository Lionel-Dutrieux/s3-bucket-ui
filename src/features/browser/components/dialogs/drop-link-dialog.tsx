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
import { createDropLink } from "@/features/browser/actions/drop";
import type { DropTarget } from "@/features/browser/hooks/use-browser-dialogs";
import { useAppForm } from "@/forms/form";
import { copyText } from "@/lib/clipboard";
import type { ShareExpiry } from "@/lib/shares/expiry";
import { allowedExpiryOptions, type SharePolicy } from "@/lib/shares/policy";

/** Optional whole-number field: empty, or an integer ≥ 1. zod messages are
 *  out of i18n scope by design (see the share dialog). */
const optionalCount = z
  .string()
  .refine((value) => value.trim() === "" || /^[1-9]\d*$/.test(value.trim()), {
    message: "Enter a whole number of 1 or more, or leave it empty.",
  });

function makeDropSchema(
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
    maxFiles: optionalCount,
    maxSizeMb: optionalCount,
    note: z.string().max(500),
  });
}

export function DropLinkDialog({
  sourceId,
  target,
  policy,
  onOpenChange,
}: {
  sourceId: string;
  /** The folder (or root) to mint a deposit link for — null keeps it closed. */
  target: DropTarget | null;
  /** Org-wide constraints — pre-constrains expiry and password inputs. */
  policy?: SharePolicy;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("browser.dropDialog");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const maxExpiryDays = policy?.maxExpiryDays ?? null;
  const requirePassword = policy?.requirePassword ?? false;
  const expiryOptions = useMemo(
    () => allowedExpiryOptions(maxExpiryDays),
    [maxExpiryDays],
  );
  const defaultExpiry: ShareExpiry = useMemo(() => {
    if (maxExpiryDays === null) return "7d";
    return expiryOptions[expiryOptions.length - 1]?.value ?? "1d";
  }, [maxExpiryDays, expiryOptions]);
  const dropSchema = useMemo(
    () => makeDropSchema(expiryOptions, requirePassword),
    [expiryOptions, requirePassword],
  );

  const form = useAppForm({
    defaultValues: {
      expiresIn: defaultExpiry,
      password: "",
      maxFiles: "",
      maxSizeMb: "",
      note: "",
    },
    validators: { onChange: dropSchema },
    onSubmit: async ({ value }) => {
      if (!target) return;
      const maxFiles = value.maxFiles.trim();
      const maxSizeMb = value.maxSizeMb.trim();
      const result = await createDropLink(sourceId, target.prefix, {
        expiresIn: value.expiresIn,
        password: value.password.trim() || undefined,
        maxFiles: maxFiles ? Number(maxFiles) : undefined,
        maxSizeMb: maxSizeMb ? Number(maxSizeMb) : undefined,
        note: value.note.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCreatedUrl(`${window.location.origin}/d/${result.data.token}`);
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
            {t(target?.isRoot ? "titleRoot" : "title", {
              name: target?.name ?? "",
            })}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
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
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="maxFiles">
                {(field) => (
                  <field.TextField
                    label={t("maxFilesLabel")}
                    type="number"
                    autoComplete="off"
                    placeholder={t("maxFilesPlaceholder")}
                  />
                )}
              </form.AppField>
              <form.AppField name="maxSizeMb">
                {(field) => (
                  <field.TextField
                    label={t("maxSizeLabel")}
                    type="number"
                    autoComplete="off"
                    placeholder={t("maxSizePlaceholder")}
                  />
                )}
              </form.AppField>
            </div>
            <form.AppField name="note">
              {(field) => (
                <field.TextField
                  label={t("noteLabel")}
                  autoComplete="off"
                  placeholder={t("notePlaceholder")}
                />
              )}
            </form.AppField>
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
