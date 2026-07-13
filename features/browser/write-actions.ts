"use server";

import type { Files } from "files-sdk";
import { withWriteAccess } from "@/features/browser/guards";
import {
  DELETE_ENTRIES_MAX,
  DELETE_FOLDER_BATCH,
  DELETE_FOLDER_MAX_ROUNDS,
  FOLDER_MOVE_CONCURRENCY,
  FOLDER_MOVE_LIST_BATCH,
  FOLDER_MOVE_MAX_OBJECTS,
  MOVE_ENTRIES_MAX,
} from "@/features/browser/limits";
import {
  basename,
  type EntryTarget,
  folderName,
  planMove,
} from "@/features/browser/move";
import { recordOperation } from "@/lib/dal/operations";

const RENAME_DENIED =
  "Renaming needs both upload and delete enabled on this source.";

function invalidEntryName(name: string): string | null {
  if (!name) return "Name is required.";
  if (name.includes("/")) return "Names can't contain “/”.";
  return null;
}

/**
 * Creates a folder by writing the zero-byte `prefix/` marker object — the
 * same convention the provider dashboards use, and what makes an otherwise
 * empty folder appear in delimiter listings. Gated on allowUpload.
 */
export async function createFolder(
  sourceId: string,
  prefix: string,
  name: string,
): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Folder name is required." };
  if (trimmed.includes("/")) {
    return { error: "Folder names can't contain “/”." };
  }

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
      return {};
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
): Promise<{ error?: string }> {
  const trimmed = newName.trim();
  const invalid = invalidEntryName(trimmed);
  if (invalid) return { error: invalid };

  return withWriteAccess(
    sourceId,
    {
      need: { upload: true, delete: true },
      denied: RENAME_DENIED,
      action: "rename this file",
    },
    async ({ source, files }) => {
      const newKey = key.slice(0, key.lastIndexOf("/") + 1) + trimmed;
      if (newKey === key) return {};
      if (await files.exists(newKey)) {
        return { error: "Something with that name already exists here." };
      }
      await files.move(key, newKey);
      await recordOperation({
        action: "rename",
        sourceId: source.id,
        sourceName: source.name,
        target: key,
        detail: `→ ${trimmed}`,
      });
      return {};
    },
  );
}

/**
 * Moves every object under `srcPrefix` to `destPrefix` (copy + delete each),
 * bounded. Returns the moved count, or an error string when the prefix is too
 * large. Shared by folder rename and folder move.
 */
async function movePrefix(
  files: Files,
  srcPrefix: string,
  destPrefix: string,
): Promise<{ error?: string; count?: number }> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await files.list({
      prefix: srcPrefix,
      cursor,
      limit: FOLDER_MOVE_LIST_BATCH,
    });
    keys.push(...page.items.map((item) => item.key));
    cursor = page.cursor;
    if (keys.length > FOLDER_MOVE_MAX_OBJECTS) {
      return {
        error: `This folder holds more than ${FOLDER_MOVE_MAX_OBJECTS} objects — too large to move in one go.`,
      };
    }
  } while (cursor);

  for (let i = 0; i < keys.length; i += FOLDER_MOVE_CONCURRENCY) {
    await Promise.all(
      keys
        .slice(i, i + FOLDER_MOVE_CONCURRENCY)
        .map((key) =>
          files.move(key, destPrefix + key.slice(srcPrefix.length)),
        ),
    );
  }
  return { count: keys.length };
}

/** Renames a folder by moving everything under its prefix. Needs both write
 * permissions, like {@link renameObject}. */
export async function renameFolder(
  sourceId: string,
  prefix: string,
  newName: string,
): Promise<{ error?: string }> {
  if (!prefix.endsWith("/")) return { error: "Invalid folder." };
  const trimmed = newName.trim();
  const invalid = invalidEntryName(trimmed);
  if (invalid) return { error: invalid };

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
      if (newPrefix === prefix) return {};

      const conflict = await files.list({ prefix: newPrefix, limit: 1 });
      if (conflict.items.length > 0) {
        return { error: "A folder with that name already exists here." };
      }

      const result = await movePrefix(files, prefix, newPrefix);
      if (result.error) return { error: result.error };

      await recordOperation({
        action: "rename-folder",
        sourceId: source.id,
        sourceName: source.name,
        target: prefix,
        detail: `→ ${trimmed}/ (${result.count} object${result.count === 1 ? "" : "s"})`,
      });
      return {};
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
): Promise<{ error?: string }> {
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
      return {};
    },
  );
}

/**
 * Deletes every object under a prefix (recursive listing, no delimiter),
 * including the zero-byte folder markers, in bulk batches. Re-lists from the
 * start after each batch since deletions shift pages. Returns an error
 * message, or null when the prefix is fully gone.
 */
async function deletePrefix(
  files: Files,
  prefix: string,
): Promise<string | null> {
  for (let round = 0; round < DELETE_FOLDER_MAX_ROUNDS; round++) {
    const page = await files.list({ prefix, limit: DELETE_FOLDER_BATCH });
    if (page.items.length === 0) return null;
    const result = await files.delete(page.items.map((item) => item.key));
    if (result.errors?.length) {
      return `${result.errors.length} object${result.errors.length === 1 ? "" : "s"} could not be deleted.`;
    }
    if (!page.cursor) return null;
  }
  return "This folder is too large to delete in one go — some objects remain, run it again.";
}

/** Deletes a folder and everything inside it. Gated on allowDelete. */
export async function deleteFolder(
  sourceId: string,
  prefix: string,
): Promise<{ error?: string }> {
  // A folder prefix is never empty — refuse anything that could sweep the
  // whole bucket.
  if (!prefix.endsWith("/")) return { error: "Invalid folder." };

  return withWriteAccess(
    sourceId,
    {
      need: { delete: true },
      denied: "Deletions are not allowed on this source.",
      action: "delete this folder",
    },
    async ({ source, files }) => {
      const error = await deletePrefix(files, prefix);
      if (!error) {
        await recordOperation({
          action: "delete-folder",
          sourceId: source.id,
          sourceName: source.name,
          target: prefix,
        });
      }
      return error ? { error } : {};
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
): Promise<{ error?: string }> {
  if (targets.length === 0) return {};
  if (targets.length > DELETE_ENTRIES_MAX) {
    return { error: `Select at most ${DELETE_ENTRIES_MAX} items at a time.` };
  }
  if (
    targets.some(
      (target) => target.kind === "folder" && !target.prefix.endsWith("/"),
    )
  ) {
    return { error: "Invalid folder." };
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
        ? {
            error: `${failures.length} item${failures.length === 1 ? "" : "s"} could not be deleted.`,
          }
        : {};
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
): Promise<{ error?: string }> {
  if (destPrefix !== "" && !destPrefix.endsWith("/")) {
    return { error: "Invalid destination." };
  }
  if (targets.length === 0) return {};
  if (targets.length > MOVE_ENTRIES_MAX) {
    return { error: `Move at most ${MOVE_ENTRIES_MAX} items at a time.` };
  }
  if (
    targets.some(
      (target) => target.kind === "folder" && !target.prefix.endsWith("/"),
    )
  ) {
    return { error: "Invalid folder." };
  }

  const plan = planMove(targets, destPrefix);
  if (plan.error) return { error: plan.error };
  if (plan.moves.length === 0) return {};

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
        return {
          error: `Already exists in the destination: ${conflicts.join(", ")}.`,
        };
      }

      for (const move of plan.moves) {
        if (move.kind === "file") {
          await files.move(move.from, move.to);
        } else {
          const result = await movePrefix(files, move.from, move.to);
          if (result.error) return { error: result.error };
        }
      }

      await recordOperation({
        action: "move",
        sourceId: source.id,
        sourceName: source.name,
        target: `${plan.moves.length} item${plan.moves.length === 1 ? "" : "s"}`,
        detail: `→ ${destPrefix || "/"}`,
      });
      return {};
    },
  );
}
