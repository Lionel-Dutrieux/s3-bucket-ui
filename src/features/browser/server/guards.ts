import "server-only";
import type { Files } from "files-sdk";
import { type ActionResult, actionError } from "@/lib/action-result";
import { getSource, type Source } from "@/lib/dal/sources";
import { getFilesClient } from "@/lib/storage/client";

export interface WriteContext {
  source: Source;
  files: Files;
}

interface WriteGuard {
  /** Permissions the operation requires. */
  need: { upload?: boolean; delete?: boolean };
  /** User message when a required permission is off. */
  denied: string;
  /** Verb phrase used for the log tag ("… failed") and the default error
   *  ("Could not ….") — e.g. "create the folder", "delete this file". */
  action: string;
  /** Overrides the error returned on an unexpected failure. */
  failureMessage?: string;
}

/**
 * Shared preamble for every write action: resolve the source, enforce the
 * per-source write permission **server-side** (hiding a control is only
 * cosmetic — this is the real gate), then run the mutation with uniform error
 * logging. The callback receives the decrypted source and a ready storage
 * client, and owns the write and its audit-log entry.
 */
export async function withWriteAccess(
  sourceId: string,
  guard: WriteGuard,
  run: (ctx: WriteContext) => Promise<ActionResult>,
): Promise<ActionResult> {
  const source = await getSource(sourceId);
  if (!source) return actionError("Source not found.");
  if (guard.need.upload && !source.allowUpload) {
    return actionError(guard.denied);
  }
  if (guard.need.delete && !source.allowDelete) {
    return actionError(guard.denied);
  }

  try {
    return await run({ source, files: getFilesClient(source) });
  } catch (error) {
    console.error(
      `[browser] ${guard.action} failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return actionError(guard.failureMessage ?? `Could not ${guard.action}.`);
  }
}
