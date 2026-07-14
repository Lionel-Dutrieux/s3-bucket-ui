"use server";

import { duplicateKeyCandidate } from "@/features/browser/lib/duplicate";
import {
  DELETE_ENTRIES_MAX,
  MOVE_ENTRIES_MAX,
} from "@/features/browser/lib/limits";
import {
  basename,
  type EntryTarget,
  folderName,
  planMove,
} from "@/features/browser/lib/move";
import {
  entryNameSchema,
  folderNameSchema,
} from "@/features/browser/lib/schemas";
import { withWriteAccess } from "@/features/browser/server/guards";
import {
  type CrossCopySummary,
  copyEntriesAcross,
  deletePrefix,
  movePrefix,
} from "@/features/browser/server/mutations";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { requireSourceAccess } from "@/lib/auth/access";
import { recordOperation } from "@/lib/dal/operations";
import { getFilesClient } from "@/lib/storage/client";

const RENAME_DENIED = "You are not allowed to edit this source.";

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
  const parsed = folderNameSchema.safeParse(name);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid name.");
  }
  const trimmed = parsed.data;

  return withWriteAccess(
    sourceId,
    {
      need: { edit: true },
      denied: "You are not allowed to add files to this source.",
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
  const parsed = entryNameSchema.safeParse(newName);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid name.");
  }
  const trimmed = parsed.data;

  return withWriteAccess(
    sourceId,
    {
      need: { edit: true },
      denied: RENAME_DENIED,
      action: "rename this file",
    },
    async ({ source, files }) => {
      const newKey = key.slice(0, key.lastIndexOf("/") + 1) + trimmed;
      if (newKey === key) return actionOk();
      if (await files.exists(newKey)) {
        return actionError("Something with that name already exists here.");
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
  if (!prefix.endsWith("/")) return actionError("Invalid folder.");
  const parsed = folderNameSchema.safeParse(newName);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid name.");
  }
  const trimmed = parsed.data;

  return withWriteAccess(
    sourceId,
    {
      need: { edit: true },
      denied: RENAME_DENIED,
      action: "rename this folder",
      failureMessage:
        "Could not rename this folder — some objects may have moved already, refresh to check.",
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
        return actionError("A folder with that name already exists here.");
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
  if (!key || key.endsWith("/")) return actionError("Invalid file.");

  return withWriteAccess(
    sourceId,
    {
      need: { edit: true },
      denied: "You are not allowed to edit this source.",
      action: "duplicate this file",
    },
    async ({ source, files }) => {
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
      return actionError(
        "Too many copies of this file already exist here — rename one first.",
      );
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
  return withWriteAccess(
    sourceId,
    {
      need: { delete: true },
      denied: "You are not allowed to delete from this source.",
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
  // A folder prefix is never empty — refuse anything that could sweep the
  // whole bucket.
  if (!prefix.endsWith("/")) return actionError("Invalid folder.");

  return withWriteAccess(
    sourceId,
    {
      need: { delete: true },
      denied: "You are not allowed to delete from this source.",
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
  if (targets.length === 0) return actionOk();
  if (targets.length > DELETE_ENTRIES_MAX) {
    return actionError(`Select at most ${DELETE_ENTRIES_MAX} items at a time.`);
  }
  if (
    targets.some(
      (target) => target.kind === "folder" && !target.prefix.endsWith("/"),
    )
  ) {
    return actionError("Invalid folder.");
  }

  return withWriteAccess(
    sourceId,
    {
      need: { delete: true },
      denied: "You are not allowed to delete from this source.",
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
        ? actionError(
            `${failures.length} item${failures.length === 1 ? "" : "s"} could not be deleted.`,
          )
        : actionOk();
    },
  );
}

/**
 * Copies a selection of files/folders into a folder of another (or the same)
 * source. Reading the origin needs a read grant; writing the destination
 * needs its edit capability — both re-checked here, uniform 404-style
 * messages so unreadable sources stay invisible. Existing destination keys
 * are skipped rather than overwritten; nothing is removed from the origin.
 */
export async function copyEntriesToSource(
  sourceId: string,
  destSourceId: string,
  targets: EntryTarget[],
  destPrefix: string,
): Promise<ActionResult<CrossCopySummary>> {
  if (destPrefix !== "" && !destPrefix.endsWith("/")) {
    return actionError("Invalid destination.");
  }
  if (targets.length === 0) return actionError("Nothing selected.");
  if (
    targets.some(
      (target) => target.kind === "folder" && !target.prefix.endsWith("/"),
    )
  ) {
    return actionError("Invalid folder.");
  }

  const origin = await requireSourceAccess(sourceId);
  if (!origin) return actionError("Source not found.");
  const dest = await requireSourceAccess(destSourceId);
  if (!dest) return actionError("Destination not found.");
  if (!dest.access.canEdit) {
    return actionError("You are not allowed to add files to that source.");
  }

  try {
    const result = await copyEntriesAcross(
      getFilesClient(origin.source),
      getFilesClient(dest.source),
      targets,
      destPrefix,
    );
    if ("error" in result) return actionError(result.error);

    const single = targets.length === 1 ? targets[0] : null;
    await recordOperation({
      action: "copy-to",
      sourceId: origin.source.id,
      sourceName: origin.source.name,
      target: single
        ? single.kind === "file"
          ? single.key
          : single.prefix
        : `${targets.length} items`,
      detail: `→ ${dest.source.name}:/${destPrefix}`,
    });
    return actionOk(result.summary);
  } catch (error) {
    console.error(
      `[browser] cross-copy failed (source=${sourceId} → ${destSourceId}):`,
      error,
    );
    return actionError("Could not copy the selection — try again.");
  }
}

/**
 * Moves a selection of files/folders into `destPrefix` ("" = root). A move
 * keeps the content (copy + delete of the old key), so edit gates it. All-or-nothing on name
 * conflicts: if any destination is occupied, nothing moves.
 */
export async function moveEntries(
  sourceId: string,
  targets: EntryTarget[],
  destPrefix: string,
): Promise<ActionResult> {
  if (destPrefix !== "" && !destPrefix.endsWith("/")) {
    return actionError("Invalid destination.");
  }
  if (targets.length === 0) return actionOk();
  if (targets.length > MOVE_ENTRIES_MAX) {
    return actionError(`Move at most ${MOVE_ENTRIES_MAX} items at a time.`);
  }
  if (
    targets.some(
      (target) => target.kind === "folder" && !target.prefix.endsWith("/"),
    )
  ) {
    return actionError("Invalid folder.");
  }

  const plan = planMove(targets, destPrefix);
  if (plan.error) return actionError(plan.error);
  if (plan.moves.length === 0) return actionOk();

  return withWriteAccess(
    sourceId,
    {
      need: { edit: true },
      denied: "You are not allowed to edit this source.",
      action: "move the selection",
      failureMessage:
        "Could not move everything — some items may have moved already, refresh to check.",
    },
    async ({ source, files }) => {
      // Conflict pre-check: refuse the whole move if any destination exists.
      const conflicts: string[] = [];
      for (const move of plan.moves) {
        if (move.kind === "file") {
          if (await files.exists(move.to)) conflicts.push(basename(move.to));
        } else {
          const existing = await files.list({ prefix: move.to, limit: 1 });
          if (existing.items.length > 0) conflicts.push(folderName(move.to));
        }
      }
      if (conflicts.length > 0) {
        return actionError(
          `Already exists in the destination: ${conflicts.join(", ")}.`,
        );
      }

      for (const move of plan.moves) {
        if (move.kind === "file") {
          await files.move(move.from, move.to);
        } else {
          const result = await movePrefix(files, move.from, move.to);
          if (result.error) return actionError(result.error);
        }
      }

      await recordOperation({
        action: "move",
        sourceId: source.id,
        sourceName: source.name,
        // A single move logs the actual key — "1 item" tells nobody anything.
        target:
          plan.moves.length === 1
            ? plan.moves[0].from
            : `${plan.moves.length} items`,
        detail: `→ ${destPrefix || "/"}`,
      });
      return actionOk();
    },
  );
}
