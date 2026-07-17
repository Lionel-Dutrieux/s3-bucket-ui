"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { profileSchema } from "@/features/auth/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { authClient } from "@/lib/auth/client";

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const t = useTranslations("account.profile");
  const [serverError, setServerError] = useState<string>();

  const form = useAppForm({
    defaultValues: { name },
    validators: { onChange: profileSchema },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const { error } = await authClient.updateUser({ name: value.name });
      if (error) {
        setServerError(error.message ?? t("updateError"));
        return;
      }
      toast.success(t("updateSuccess"));
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
          <field.TextField label={t("nameLabel")} autoComplete="name" />
        )}
      </form.AppField>

      <FormAlert error={serverError} />

      <div className="flex justify-end">
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("saving")}>
            {t("saveChanges")}
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
