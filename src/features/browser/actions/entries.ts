"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { duplicateKeyCandidate } from "@/features/browser/lib/duplicate";
import {
  BUFFERED_COPY_MAX_BYTES,
  DELETE_ENTRIES_MAX,
} from "@/features/browser/lib/limits";
import { basename } from "@/features/browser/lib/move";
import {
  entryNameSchema,
  entryTargetSchema,
  folderNameSchema,
} from "@/features/browser/lib/schemas";
import { deletePrefix, movePrefix } from "@/features/browser/server/mutations";
import { sourceAccessMiddleware } from "@/features/browser/server/source-access";
import { recordOperation } from "@/lib/dal/operations";
import { ActionError, actionClient } from "@/lib/safe-action";
import { KEEP_FILE_NAME, usesKeepFileMarkers } from "@/lib/storage/providers";

/** A folder prefix always ends with "/" — refuse anything that could otherwise
 *  sweep or address the whole bucket. */
const folderPrefixSchema = z
  .string()
  .refine((value) => value.endsWith("/"), "Invalid folder.");

/**
 * Creates a folder by writing the zero-byte `prefix/` marker object — the
 * same convention the provider dashboards use, and what makes an otherwise
 * empty folder appear in delimiter listings. Gated on the edit capability.
 */
export const createFolder = actionClient
  .metadata({
    actionName: "browser.createFolder",
    failureKey: "browser.errors.actionFailed",
  })
  .inputSchema(
    z.object({
      sourceId: z.string().min(1),
      prefix: z.string(),
      name: folderNameSchema,
    }),
  )
  .useValidated(
    sourceAccessMiddleware({
      need: { edit: true },
      deniedKey: "browser.errors.addDenied",
    }),
  )
  .action(async ({ parsedInput: { prefix, name }, ctx: { source, files } }) => {
    // Filesystem-backed adapters can't store a `prefix/` marker key (the
    // fs adapter would write a plain file named like the folder); a hidden
    // .keep file inside creates the real directory instead.
    const markerKey = usesKeepFileMarkers(source.provider)
      ? `${prefix}${name}/${KEEP_FILE_NAME}`
      : `${prefix}${name}/`;
    await files.upload(markerKey, "");
    await recordOperation({
      action: "create-folder",
      sourceId: source.id,
      sourceName: source.name,
      target: `${prefix}${name}/`,
    });
  });

/**
 * Renames one object within its folder via move (copy + delete on object
 * stores — not atomic). Renaming is an edit: the object keeps existing
 * under its new key, so the edit capability alone gates it.
 */
export const renameObject = actionClient
  .metadata({
    actionName: "browser.renameObject",
    failureKey: "browser.errors.actionFailed",
  })
  .inputSchema(
    z.object({
      sourceId: z.string().min(1),
      key: z.string().min(1),
      newName: entryNameSchema,
    }),
  )
  .useValidated(
    sourceAccessMiddleware({
      need: { edit: true },
      deniedKey: "browser.errors.editDenied",
    }),
  )
  .action(async ({ parsedInput: { key, newName }, ctx: { source, files } }) => {
    const newKey = key.slice(0, key.lastIndexOf("/") + 1) + newName;
    if (newKey === key) return;
    if (await files.exists(newKey)) {
      const t = await getTranslations("browser.errors");
      throw new ActionError(t("nameExists"));
    }
    await files.move(key, newKey);
    await recordOperation({
      action: "rename",
      sourceId: source.id,
      sourceName: source.name,
      target: key,
      detail: `→ ${newName}`,
    });
  });

/** Renames a folder by moving everything under its prefix - an edit, like
 * {@link renameObject}. */
export const renameFolder = actionClient
  .metadata({
    actionName: "browser.renameFolder",
    failureKey: "browser.errors.renameFolderFailure",
  })
  .inputSchema(
    z.object({
      sourceId: z.string().min(1),
      prefix: folderPrefixSchema,
      newName: folderNameSchema,
    }),
  )
  .useValidated(
    sourceAccessMiddleware({
      need: { edit: true },
      deniedKey: "browser.errors.editDenied",
    }),
  )
  .action(
    async ({ parsedInput: { prefix, newName }, ctx: { source, files } }) => {
      const parent = prefix.slice(
        0,
        prefix.lastIndexOf("/", prefix.length - 2) + 1,
      );
      const newPrefix = `${parent}${newName}/`;
      if (newPrefix === prefix) return;

      const conflict = await files.list({ prefix: newPrefix, limit: 1 });
      if (conflict.items.length > 0) {
        const t = await getTranslations("browser.errors");
        throw new ActionError(t("folderNameExists"));
      }

      const result = await movePrefix(files, prefix, newPrefix);
      if (result.error) throw new ActionError(result.error);

      await recordOperation({
        action: "rename-folder",
        sourceId: source.id,
        sourceName: source.name,
        target: prefix,
        detail: `→ ${newName}/ (${result.count} object${result.count === 1 ? "" : "s"})`,
      });
    },
  );

/** Attempts before giving up on finding a free "… (copy n)" key. */
const DUPLICATE_MAX_ATTEMPTS = 5;

/**
 * Duplicates one object next to itself as "name (copy).ext" (server-side
 * copy — no bytes travel through the app). Creating content is an edit.
 */
export const duplicateObject = actionClient
  .metadata({
    actionName: "browser.duplicateObject",
    failureKey: "browser.errors.actionFailed",
  })
  .inputSchema(
    z.object({
      sourceId: z.string().min(1),
      key: z
        .string()
        .min(1)
        .refine((value) => !value.endsWith("/"), "Invalid file."),
    }),
  )
  .useValidated(
    sourceAccessMiddleware({
      need: { edit: true },
      deniedKey: "browser.errors.editDenied",
    }),
  )
  .action(async ({ parsedInput: { key }, ctx: { source, files } }) => {
    const t = await getTranslations("browser.errors");
    // Without a server-side copy primitive (SFTP, FTP) the whole body is
    // buffered through this process — refuse sizes that would blow memory.
    if (!files.capabilities.serverSideCopy) {
      const stat = await files.head(key);
      if (stat.size > BUFFERED_COPY_MAX_BYTES) {
        throw new ActionError(t("duplicateTooLarge"));
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
      return;
    }
    throw new ActionError(t("tooManyDuplicates"));
  });

/**
 * Permanently deletes one object. The delete capability is enforced
 * server-side — hiding the delete UI is cosmetic, this check is the real gate.
 */
export const deleteObject = actionClient
  .metadata({
    actionName: "browser.deleteObject",
    failureKey: "browser.errors.actionFailed",
  })
  .inputSchema(
    z.object({ sourceId: z.string().min(1), key: z.string().min(1) }),
  )
  .useValidated(
    sourceAccessMiddleware({
      need: { delete: true },
      deniedKey: "browser.errors.deleteDenied",
    }),
  )
  .action(async ({ parsedInput: { key }, ctx: { source, files } }) => {
    await files.delete(key);
    await recordOperation({
      action: "delete",
      sourceId: source.id,
      sourceName: source.name,
      target: key,
    });
  });

/** Deletes a folder and everything inside it. Gated on the delete capability. */
export const deleteFolder = actionClient
  .metadata({
    actionName: "browser.deleteFolder",
    failureKey: "browser.errors.actionFailed",
  })
  .inputSchema(
    z.object({ sourceId: z.string().min(1), prefix: folderPrefixSchema }),
  )
  .useValidated(
    sourceAccessMiddleware({
      need: { delete: true },
      deniedKey: "browser.errors.deleteDenied",
    }),
  )
  .action(async ({ parsedInput: { prefix }, ctx: { source, files } }) => {
    const error = await deletePrefix(files, prefix);
    if (error) throw new ActionError(error);
    await recordOperation({
      action: "delete-folder",
      sourceId: source.id,
      sourceName: source.name,
      target: prefix,
    });
  });

/**
 * Bulk delete for a multi-selection: files go through one native bulk delete,
 * folders each get the recursive prefix sweep. Gated on the delete capability.
 */
export const deleteEntries = actionClient
  .metadata({
    actionName: "browser.deleteEntries",
    failureKey: "browser.errors.actionFailed",
  })
  .inputSchema(
    z.object({
      sourceId: z.string().min(1),
      targets: z.array(entryTargetSchema).min(1).max(DELETE_ENTRIES_MAX),
    }),
  )
  .useValidated(
    sourceAccessMiddleware({
      need: { delete: true },
      deniedKey: "browser.errors.deleteDenied",
    }),
  )
  .action(async ({ parsedInput: { targets }, ctx: { source, files } }) => {
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
    if (failures.length > 0) {
      const t = await getTranslations("browser.errors");
      throw new ActionError(
        t("someItemsFailedToDelete", { count: failures.length }),
      );
    }
  });
