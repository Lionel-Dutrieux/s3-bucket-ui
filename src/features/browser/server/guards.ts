import "server-only";
import type { Files } from "files-sdk";
import { getTranslations } from "next-intl/server";
import { type ActionResult, actionError } from "@/lib/action-result";
import { requireSourceAccess } from "@/lib/auth/access";
import type { Source } from "@/lib/dal/sources";
import { getFilesClient } from "@/lib/storage/client";

export interface WriteContext {
  source: Source;
  files: Files;
}

interface WriteGuard {
  /** Capabilities the operation requires (edit = upload/rename/new folder). */
  need: { edit?: boolean; delete?: boolean };
  /** User message when a required capability is missing. */
  denied: string;
  /** Verb phrase used for the log tag ("… failed") — e.g. "create the
   *  folder", "delete this file". Technical, never shown to the user. */
  action: string;
  /** Overrides the error returned on an unexpected failure. */
  failureMessage?: string;
}

/**
 * Shared preamble for every write action: session + read grant (uniform
 * "Source not found." otherwise, so unreadable sources stay invisible), then
 * the required capabilities enforced **server-side** (hiding a control is
 * only cosmetic — this is the real gate), then the mutation with uniform
 * error logging. The callback receives the decrypted source and a ready
 * storage client, and owns the write and its audit-log entry.
 */
export async function withWriteAccess(
  sourceId: string,
  guard: WriteGuard,
  run: (ctx: WriteContext) => Promise<ActionResult>,
): Promise<ActionResult> {
  const t = await getTranslations("browser.errors");
  const result = await requireSourceAccess(sourceId);
  if (!result) return actionError(t("sourceNotFound"));
  const { source, access } = result;
  if (guard.need.edit && !access.canEdit) {
    return actionError(guard.denied);
  }
  if (guard.need.delete && !access.canDelete) {
    return actionError(guard.denied);
  }

  try {
    return await run({ source, files: getFilesClient(source) });
  } catch (error) {
    console.error(
      `[browser] ${guard.action} failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return actionError(guard.failureMessage ?? t("actionFailed"));
  }
}
