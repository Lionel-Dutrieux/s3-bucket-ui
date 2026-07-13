"use server";

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
import { deletePrefix, movePrefix } from "@/features/browser/server/mutations";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { recordOperation } from "@/lib/dal/operations";

const RENAME_DENIED =
  "Renaming needs both upload and delete enabled on this source.";

/**
 * Creates a folder by writing the zero-byte `prefix/` marker object — the
 * same convention the provider dashboards use, and what makes an otherwise
 * empty folder appear in delimiter listings. Gated on allowUpload.
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
      need: { upload: true },
      denied: "Uploads are not allowed on this source.",
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
 * stores — not atomic). Writing the new key needs allowUpload, removing the
 * old one needs allowDelete, so renaming requires both.
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
      need: { upload: true, delete: true },
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

/** Renames a folder by moving everything under its prefix. Needs both write
 * permissions, like {@link renameObject}. */
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
      need: { upload: true, delete: true },
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

/**
 * Permanently deletes one object. The allowDelete permission is enforced
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
      denied: "Deletions are not allowed on this source.",
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

/** Deletes a folder and everything inside it. Gated on allowDelete. */
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
      denied: "Deletions are not allowed on this source.",
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
 * folders each get the recursive prefix sweep. Gated on allowDelete.
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
      denied: "Deletions are not allowed on this source.",
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
        await recordOperation({
          action: "delete-many",
          sourceId: source.id,
          sourceName: source.name,
          target: `${targets.length} item${targets.length === 1 ? "" : "s"}`,
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
 * Moves a selection of files/folders into `destPrefix` ("" = root). Move is
 * copy + delete, so it needs both write permissions. All-or-nothing on name
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
      need: { upload: true, delete: true },
      denied: "Moving needs both upload and delete enabled on this source.",
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
        target: `${plan.moves.length} item${plan.moves.length === 1 ? "" : "s"}`,
        detail: `→ ${destPrefix || "/"}`,
      });
      return actionOk();
    },
  );
}
