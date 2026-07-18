"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";
import { unlockShare } from "@/features/shares/actions";
import { useAppForm } from "@/forms/form";

const schema = z.object({
  password: z.string().min(1, "Password is required."),
});

export function SharePasswordForm({ token }: { token: string }) {
  const t = useTranslations("shares.publicViewer");
  const router = useRouter();
  const form = useAppForm({
    defaultValues: { password: "" },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      const result = await unlockShare({ token, password: value.password });
      if (result.serverError) {
        toast.error(result.serverError);
        return;
      }
      // The cookie is set — re-render the page server-side, now unlocked.
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
      <p className="text-sm text-muted-foreground">{t("passwordProtected")}</p>
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label={t("passwordLabel")}
            type="password"
            autoComplete="off"
            autoFocus
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton pendingLabel={t("unlocking")}>
          {t("unlock")}
        </form.SubmitButton>
      </form.AppForm>
    </form>
  );
}
