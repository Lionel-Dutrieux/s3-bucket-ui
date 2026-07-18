import "server-only";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";
import { currentAdmin, currentUser } from "@/lib/auth/session";

/** Error whose message is already translated and safe to show in the UI. */
export class ActionError extends Error {}

// getTranslations is typed against the known message keys; resolveActionMessage
// builds its namespace/key from a runtime string (metadata.failureKey), so it
// needs a loosened view of the function.
const getTranslationsLoose = getTranslations as (
  namespace: string,
) => Promise<(key: string) => string>;

/** Resolves a full i18n key like "admin.errors.notAuthorized" to its text. */
export async function resolveActionMessage(key: string): Promise<string> {
  const i = key.lastIndexOf(".");
  const t = await getTranslationsLoose(key.slice(0, i));
  return t(key.slice(i + 1));
}

/**
 * Base client for every server action. Metadata is mandatory: `actionName`
 * labels the action in logs, `revalidate` opts out of layout revalidation,
 * `failureKey` is a full i18n key shown instead of the generic message when an
 * unexpected error surfaces. Validation errors come back flattened.
 */
export const actionClient = createSafeActionClient({
  defineMetadataSchema: () =>
    z.object({
      actionName: z.string(),
      revalidate: z.boolean().optional(),
      failureKey: z.string().optional(),
    }),
  defaultValidationErrorsShape: "flattened",
  async handleServerError(error, { metadata }) {
    // ActionError messages are already translated and UI-safe.
    if (error instanceof ActionError) return error.message;
    console.error(`[${metadata?.actionName ?? "action"}] failed:`, error);
    return resolveActionMessage(metadata?.failureKey ?? "common.actionFailed");
  },
});

/** `actionClient` gated on an authenticated caller; `ctx.user` is the session user. */
export const authActionClient = actionClient.use(async ({ next }) => {
  const user = await currentUser();
  if (!user) {
    const t = await getTranslations("common");
    throw new ActionError(t("notAuthenticated"));
  }
  return next({ ctx: { user } });
});

/**
 * `actionClient` gated on an admin caller; `ctx.admin` is the session user.
 * Revalidates the root layout after a successful mutation unless the action's
 * metadata sets `revalidate: false`.
 */
export const adminActionClient = actionClient.use(
  async ({ next, metadata }) => {
    const admin = await currentAdmin();
    if (!admin) {
      const t = await getTranslations("admin.errors");
      throw new ActionError(t("notAuthorized"));
    }
    const result = await next({ ctx: { admin } });
    if (result.success && metadata.revalidate !== false) {
      revalidatePath("/", "layout");
    }
    return result;
  },
);
