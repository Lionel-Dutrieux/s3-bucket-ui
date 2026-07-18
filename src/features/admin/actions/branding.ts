"use server";

import { z } from "zod";
import { brandingSchema } from "@/features/admin/lib/schema";
import {
  clearBrandingSettings,
  updateBrandingSettings,
} from "@/lib/dal/settings";
import { adminActionClient } from "@/lib/safe-action";

// Every action runs through adminActionClient (src/lib/safe-action.ts), which
// re-checks the admin role server-side — the /admin layout guard protects
// pages only, never these POST endpoints — and revalidates the root layout on
// success.

export const updateBranding = adminActionClient
  .metadata({
    actionName: "admin.updateBranding",
    failureKey: "admin.errors.brandingSaveFailed",
  })
  .inputSchema(brandingSchema)
  .action(async ({ parsedInput }) => {
    await updateBrandingSettings(parsedInput);
  });

export const resetBranding = adminActionClient
  .metadata({
    actionName: "admin.resetBranding",
    failureKey: "admin.errors.brandingResetFailed",
  })
  .inputSchema(z.object({}))
  .action(async () => {
    await clearBrandingSettings();
  });
