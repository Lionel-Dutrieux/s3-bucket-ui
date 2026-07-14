"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { profileSchema } from "@/features/auth/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";
import { authClient } from "@/lib/auth/client";

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();

  const form = useAppForm({
    defaultValues: { name },
    validators: { onChange: profileSchema },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const { error } = await authClient.updateUser({ name: value.name });
      if (error) {
        setServerError(error.message ?? "Could not update your profile.");
        return;
      }
      toast.success("Profile updated");
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
        {(field) => <field.TextField label="Name" autoComplete="name" />}
      </form.AppField>

      <FormAlert error={serverError} />

      <div className="flex justify-end">
        <form.AppForm>
          <form.SubmitButton pendingLabel="Saving…">
            Save changes
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
