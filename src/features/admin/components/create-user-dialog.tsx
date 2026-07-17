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
import { createUser } from "@/features/admin/actions";
import { createUserSchema } from "@/features/admin/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";

export function CreateUserDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("admin.createUserDialog");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {open ? <CreateUserForm onSuccess={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateUserForm({ onSuccess }: { onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string>();
  const router = useRouter();
  const t = useTranslations("admin.createUserDialog");

  const form = useAppForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "user" as "user" | "admin",
    },
    validators: { onChange: createUserSchema },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const result = await createUser(value);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      toast.success(t("createdToast", { email: value.email }));
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
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label={t("emailLabel")}
            type="email"
            placeholder={t("emailPlaceholder")}
          />
        )}
      </form.AppField>
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label={t("passwordLabel")}
            type="password"
            autoComplete="new-password"
          />
        )}
      </form.AppField>
      <form.AppField name="role">
        {(field) => (
          <field.SelectField
            label={t("roleLabel")}
            options={[
              { value: "user", label: t("roleUser") },
              { value: "admin", label: t("roleAdmin") },
            ]}
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
