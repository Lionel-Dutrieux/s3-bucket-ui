"use server";

import { getTranslations } from "next-intl/server";
import {
  type BrandingValues,
  brandingSchema,
} from "@/features/admin/lib/schema";
import { withAdmin } from "@/features/admin/server/guard";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import {
  clearBrandingSettings,
  updateBrandingSettings,
} from "@/lib/dal/settings";

// Every action runs through withAdmin (features/admin/server/guard.ts), which
// re-checks the admin role server-side — the /admin layout guard protects
// pages only, never these POST endpoints.

export async function updateBranding(
  input: BrandingValues,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "update branding",
      failureMessage: t("brandingSaveFailed"),
    },
    async () => {
      const parsed = brandingSchema.safeParse(input);
      if (!parsed.success) {
        return actionError(
          parsed.error.issues[0]?.message ?? t("invalidInput"),
        );
      }
      await updateBrandingSettings(parsed.data);
      return actionOk();
    },
  );
}

export async function resetBranding(): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "reset branding",
      failureMessage: t("brandingResetFailed"),
    },
    async () => {
      await clearBrandingSettings();
      return actionOk();
    },
  );
}
