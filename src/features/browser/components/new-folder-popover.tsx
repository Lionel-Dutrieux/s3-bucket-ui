"use client";

import { useStore } from "@tanstack/react-form";
import { FolderPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createFolder } from "@/features/browser/actions/entries";
import { folderNameSchema } from "@/features/browser/lib/schemas";
import { useAppForm } from "@/forms/form";

const newFolderSchema = z.object({ name: folderNameSchema });

/** One field, one button — a popover anchored on the trigger, not a modal. */
export function NewFolderPopover({
  sourceId,
  prefix,
  onCreated,
}: {
  sourceId: string;
  prefix: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("browser.newFolder");
  const form = useAppForm({
    defaultValues: { name: "" },
    validators: {
      // Same schema as the server action — errors map onto the field.
      onChange: newFolderSchema,
    },
    onSubmit: async ({ value }) => {
      const result = await createFolder({ sourceId, prefix, name: value.name });
      if (result.serverError) {
        toast.error(result.serverError);
        return;
      }
      toast.success(t("createdToast", { name: value.name.trim() }));
      form.reset();
      setOpen(false);
      onCreated();
    },
  });
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) {
          if (!next) form.reset();
          setOpen(next);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          title={t("trigger")}
        >
          <FolderPlus aria-hidden />
          <span className="max-sm:sr-only">{t("trigger")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-3"
        >
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label={t("label")}
                placeholder={t("placeholder")}
                autoFocus
              />
            )}
          </form.AppField>
          <form.Subscribe selector={(state) => state.values.name}>
            {(name) => (
              <form.AppForm>
                <form.SubmitButton
                  pendingLabel={t("creating")}
                  disabled={name.trim() === ""}
                  className="w-full"
                >
                  {t("create")}
                </form.SubmitButton>
              </form.AppForm>
            )}
          </form.Subscribe>
        </form>
      </PopoverContent>
    </Popover>
  );
}
