"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createGroup } from "@/features/admin/actions/groups";
import { createGroupSchema } from "@/features/admin/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";

export function CreateGroupDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("admin.createGroupDialog");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {open ? <CreateGroupForm onSuccess={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateGroupForm({ onSuccess }: { onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string>();
  const router = useRouter();
  const t = useTranslations("admin.createGroupDialog");

  const form = useAppForm({
    defaultValues: { name: "" },
    validators: { onChange: createGroupSchema },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const result = await createGroup(value.name);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      toast.success(t("createdToast", { name: value.name.trim() }));
      onSuccess();
      router.refresh();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.AppField name="name">
        {(field) => (
          <field.TextField
            label={t("nameLabel")}
            placeholder={t("namePlaceholder")}
            autoFocus
          />
        )}
      </form.AppField>

      <FormAlert error={serverError} />

      <DialogFooter>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("submitPending")}>
            {t("submit")}
          </form.SubmitButton>
        </form.AppForm>
      </DialogFooter>
    </form>
  );
}
