import "server-only";
import type { Files } from "files-sdk";
import { getTranslations } from "next-intl/server";
import { createValidatedMiddleware } from "next-safe-action";
import { requireSourceAccess } from "@/lib/auth/access";
import type { SourceCapabilities } from "@/lib/authz/permissions";
import type { Source } from "@/lib/dal/sources";
import { ActionError, resolveActionMessage } from "@/lib/safe-action";
import { getFilesClient } from "@/lib/storage/client";

/** Context a source-access-gated action receives once the middleware runs. */
export interface SourceAccessContext {
  source: Source;
  files: Files;
  access: SourceCapabilities;
}

interface SourceAccessOptions {
  /** Capabilities the action requires (edit = upload/rename/new folder). Omit
   *  for read-only actions (e.g. createShareLink). */
  need?: { edit?: boolean; delete?: boolean };
  /** Full i18n key for the message shown when a required capability is missing. */
  deniedKey?: string;
}

/**
 * The shared preamble for actions scoped to a source. Re-checks the read grant
 * server-side (uniform "Source not found." otherwise, so unreadable sources stay
 * invisible), then enforces
 * the required capabilities — hiding a control is only cosmetic, this is the
 * real gate — and injects the decrypted source, a ready storage client and the
 * resolved capabilities on `ctx`. Constrained to a `{ sourceId: string }`
 * parsedInput, so it must run after `inputSchema` via `useValidated`.
 */
export function sourceAccessMiddleware({
  need,
  deniedKey,
}: SourceAccessOptions) {
  return createValidatedMiddleware<{
    parsedInput: { sourceId: string };
  }>().define(async ({ parsedInput, next }) => {
    const result = await requireSourceAccess(parsedInput.sourceId);
    if (!result) {
      const t = await getTranslations("browser.errors");
      throw new ActionError(t("sourceNotFound"));
    }

    const { source, access } = result;
    if (
      (need?.edit && !access.canEdit) ||
      (need?.delete && !access.canDelete)
    ) {
      throw new ActionError(
        await resolveActionMessage(deniedKey ?? "browser.errors.actionFailed"),
      );
    }

    return next({
      ctx: {
        source,
        files: getFilesClient(source),
        access,
      } satisfies SourceAccessContext,
    });
  });
}
