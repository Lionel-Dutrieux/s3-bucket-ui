"use client";

import { useStore } from "@tanstack/react-form";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
import type { FileEntry } from "@/features/browser/lib/listing";
import { useAppForm } from "@/forms/form";
import { copyText } from "@/lib/clipboard";
import { SHARE_EXPIRY_OPTIONS, type ShareExpiry } from "@/lib/shares/expiry";

const shareSchema = z.object({
  expiresIn: z.enum(["1d", "7d", "30d", "never"]),
  password: z.string().max(128),
});

export function ShareDialog({
  sourceId,
  file,
  onOpenChange,
}: {
  sourceId: string;
  file: FileEntry | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("browser.shareDialog");
  // Once minted, the dialog switches to the copy view until closed.
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useAppForm({
    defaultValues: { expiresIn: "7d" as ShareExpiry, password: "" },
    validators: { onChange: shareSchema },
    onSubmit: async ({ value }) => {
      if (!file) return;
      const result = await createShareLink(sourceId, file.key, {
        expiresIn: value.expiresIn,
        password: value.password.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
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
    <Dialog open={file !== null} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">
            {t("title", { name: file?.name ?? "" })}
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
                  options={SHARE_EXPIRY_OPTIONS}
                />
              )}
            </form.AppField>
            <form.AppField name="password">
              {(field) => (
                <field.TextField
                  label={t("passwordLabel")}
                  type="password"
                  autoComplete="off"
                  placeholder={t("passwordPlaceholder")}
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
