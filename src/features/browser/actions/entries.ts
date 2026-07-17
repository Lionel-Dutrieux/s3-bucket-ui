"use server";

import { getTranslations } from "next-intl/server";
import { duplicateKeyCandidate } from "@/features/browser/lib/duplicate";
import {
  BUFFERED_COPY_MAX_BYTES,
  DELETE_ENTRIES_MAX,
} from "@/features/browser/lib/limits";
import { basename, type EntryTarget } from "@/features/browser/lib/move";
import {
  entryNameSchema,
  folderNameSchema,
} from "@/features/browser/lib/schemas";
import { withWriteAccess } from "@/features/browser/server/guards";
import { deletePrefix, movePrefix } from "@/features/browser/server/mutations";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { recordOperation } from "@/lib/dal/operations";

/**
 * Creates a folder by writing the zero-byte `prefix/` marker object — the
 * same convention the provider dashboards use, and what makes an otherwise
 * empty folder appear in delimiter listings. Gated on the edit capability.
 */
export async function createFolder(
  sourceId: string,
  prefix: string,
  name: string,
): Promise<ActionResult> {
  const t = await getTranslations("browser.errors");
  const parsed = folderNameSchema.safeParse(name);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? t("invalidName"));
  }
  const trimmed = parsed.data;

  return withWriteAccess(
    sourceId,
    {
      need: { edit: true },
      denied: t("addDenied"),
      action: "create the folder",
    },
    async ({ source, files }) => {
      await files.upload(`${prefix}${trimmed}/`, "");
      await recordOperation({
        action: "create-folder",
        sourceId: source.id,
        sourceName: source.name,
        target: `${prefix}${trimmed}/`,
      });
      return actionOk();
    },
  );
}

/**
 * Renames one object within its folder via move (copy + delete on object
 * stores — not atomic). Renaming is an edit: the object keeps existing
 * under its new key, so the edit capability alone gates it.
 */
export async function renameObject(
  sourceId: string,
  key: string,
  newName: string,
): Promise<ActionResult> {
  const t = await getTranslations("browser.errors");
  const parsed = entryNameSchema.safeParse(newName);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? t("invalidName"));
  }
  const trimmed = parsed.data;

  return withWriteAccess(
    sourceId,
    {
      need: { edit: true },
      denied: t("editDenied"),
      action: "rename this file",
    },
    async ({ source, files }) => {
      const newKey = key.slice(0, key.lastIndexOf("/") + 1) + trimmed;
      if (newKey === key) return actionOk();
      if (await files.exists(newKey)) {
        return actionError(t("nameExists"));
      }
      await files.move(key, newKey);
      await recordOperation({
        action: "rename",
        sourceId: source.id,
        sourceName: source.name,
        target: key,
        detail: `→ ${trimmed}`,
      });
      return actionOk();
    },
  );
}

/** Renames a folder by moving everything under its prefix - an edit, like
 * {@link renameObject}. */
export async function renameFolder(
  sourceId: string,
  prefix: string,
  newName: string,
): Promise<ActionResult> {
  const t = await getTranslations("browser.errors");
  if (!prefix.endsWith("/")) return actionError(t("invalidFolder"));
  const parsed = folderNameSchema.safeParse(newName);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? t("invalidName"));
  }
  const trimmed = parsed.data;

  return withWriteAccess(
    sourceId,
    {
      need: { edit: true },
      denied: t("editDenied"),
      action: "rename this folder",
      failureMessage: t("renameFolderFailure"),
    },
    async ({ source, files }) => {
      const parent = prefix.slice(
        0,
        prefix.lastIndexOf("/", prefix.length - 2) + 1,
      );
      const newPrefix = `${parent}${trimmed}/`;
      if (newPrefix === prefix) return actionOk();

      const conflict = await files.list({ prefix: newPrefix, limit: 1 });
      if (conflict.items.length > 0) {
        return actionError(t("folderNameExists"));
      }

      const result = await movePrefix(files, prefix, newPrefix);
      if (result.error) return actionError(result.error);

      await recordOperation({
        action: "rename-folder",
        sourceId: source.id,
        sourceName: source.name,
        target: prefix,
        detail: `→ ${trimmed}/ (${result.count} object${result.count === 1 ? "" : "s"})`,
      });
      return actionOk();
    },
  );
}

/** Attempts before giving up on finding a free "… (copy n)" key. */
const DUPLICATE_MAX_ATTEMPTS = 5;

/**
 * Duplicates one object next to itself as "name (copy).ext" (server-side
 * copy — no bytes travel through the app). Creating content is an edit.
 */
export async function duplicateObject(
  sourceId: string,
  key: string,
): Promise<ActionResult> {
  const t = await getTranslations("browser.errors");
  if (!key || key.endsWith("/")) return actionError(t("invalidFile"));

  return withWriteAccess(
    sourceId,
    {
      need: { edit: true },
      denied: t("editDenied"),
      action: "duplicate this file",
    },
    async ({ source, files }) => {
      // Without a server-side copy primitive (SFTP, FTP) the whole body is
      // buffered through this process — refuse sizes that would blow memory.
      if (!files.capabilities.serverSideCopy) {
        const stat = await files.head(key);
        if (stat.size > BUFFERED_COPY_MAX_BYTES) {
          return actionError(t("duplicateTooLarge"));
        }
      }
      for (let attempt = 1; attempt <= DUPLICATE_MAX_ATTEMPTS; attempt++) {
        const candidate = duplicateKeyCandidate(key, attempt);
        if (await files.exists(candidate)) continue;
        await files.copy(key, candidate);
        await recordOperation({
          action: "copy",
          sourceId: source.id,
          sourceName: source.name,
          target: key,
          detail: `→ ${basename(candidate)}`,
        });
        return actionOk();
      }
      return actionError(t("tooManyDuplicates"));
    },
  );
}

/**
 * Permanently deletes one object. The delete capability is enforced
 * server-side — hiding the delete UI is cosmetic, this check is the real gate.
 */
export async function deleteObject(
  sourceId: string,
  key: string,
): Promise<ActionResult> {
  const t = await getTranslations("browser.errors");
  return withWriteAccess(
    sourceId,
    {
      need: { delete: true },
      denied: t("deleteDenied"),
      action: "delete this file",
    },
    async ({ source, files }) => {
      await files.delete(key);
      await recordOperation({
        action: "delete",
        sourceId: source.id,
        sourceName: source.name,
        target: key,
      });
      return actionOk();
    },
  );
}

/** Deletes a folder and everything inside it. Gated on the delete capability. */
export async function deleteFolder(
  sourceId: string,
  prefix: string,
): Promise<ActionResult> {
  const t = await getTranslations("browser.errors");
  // A folder prefix is never empty — refuse anything that could sweep the
  // whole bucket.
  if (!prefix.endsWith("/")) return actionError(t("invalidFolder"));

  return withWriteAccess(
    sourceId,
    {
      need: { delete: true },
      denied: t("deleteDenied"),
      action: "delete this folder",
    },
    async ({ source, files }) => {
      const error = await deletePrefix(files, prefix);
      if (error) return actionError(error);
      await recordOperation({
        action: "delete-folder",
        sourceId: source.id,
        sourceName: source.name,
        target: prefix,
      });
      return actionOk();
    },
  );
}

/**
 * Bulk delete for a multi-selection: files go through one native bulk delete,
 * folders each get the recursive prefix sweep. Gated on the delete capability.
 */
export async function deleteEntries(
  sourceId: string,
  targets: EntryTarget[],
): Promise<ActionResult> {
  const t = await getTranslations("browser.errors");
  if (targets.length === 0) return actionOk();
  if (targets.length > DELETE_ENTRIES_MAX) {
    return actionError(t("selectAtMost", { max: DELETE_ENTRIES_MAX }));
  }
  if (
    targets.some(
      (target) => target.kind === "folder" && !target.prefix.endsWith("/"),
    )
  ) {
    return actionError(t("invalidFolder"));
  }

  return withWriteAccess(
    sourceId,
    {
      need: { delete: true },
      denied: t("deleteDenied"),
      action: "delete the selection",
    },
    async ({ source, files }) => {
      const failures: string[] = [];
      const fileKeys = targets.flatMap((target) =>
        target.kind === "file" ? [target.key] : [],
      );
      if (fileKeys.length > 0) {
        const result = await files.delete(fileKeys);
        if (result.errors?.length) {
          failures.push(...result.errors.map(() => "file"));
        }
      }
      for (const target of targets) {
        if (target.kind === "folder") {
          const error = await deletePrefix(files, target.prefix);
          if (error) failures.push(target.prefix);
        }
      }
      if (failures.length < targets.length) {
        const single = targets.length === 1 ? targets[0] : null;
        await recordOperation({
          action: "delete-many",
          sourceId: source.id,
          sourceName: source.name,
          target: single
            ? single.kind === "file"
              ? single.key
              : single.prefix
            : `${targets.length} items`,
          detail: failures.length > 0 ? `${failures.length} failed` : undefined,
        });
      }
      return failures.length > 0
        ? actionError(t("someItemsFailedToDelete", { count: failures.length }))
        : actionOk();
    },
  );
}
