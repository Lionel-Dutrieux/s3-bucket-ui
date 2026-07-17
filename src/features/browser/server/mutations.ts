import "server-only";
import type { Files } from "files-sdk";
import { getTranslations } from "next-intl/server";
import {
  CROSS_COPY_CONCURRENCY,
  CROSS_COPY_MAX_OBJECTS,
  DELETE_FOLDER_BATCH,
  DELETE_FOLDER_MAX_ROUNDS,
  FOLDER_MOVE_CONCURRENCY,
  FOLDER_MOVE_LIST_BATCH,
  FOLDER_MOVE_MAX_OBJECTS,
} from "@/features/browser/lib/limits";
import {
  basename,
  type EntryTarget,
  folderName,
} from "@/features/browser/lib/move";

/**
 * Moves every object under `srcPrefix` to `destPrefix` (copy + delete each),
 * bounded. Returns the moved count, or an error string when the prefix is too
 * large. Shared by folder rename and folder move.
 */
export async function movePrefix(
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
      const t = await getTranslations("browser.errors");
      return {
        error: t("folderTooLargeToMove", { max: FOLDER_MOVE_MAX_OBJECTS }),
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

export interface CrossCopySummary {
  copied: number;
  skipped: number;
  failed: number;
}

export type CrossCopyResult =
  | { error: string }
  | { summary: CrossCopySummary; copiedSrcKeys: string[] };

/**
 * Copies a selection (files + folders, expanded and bounded) from one source
 * into a folder of another — each object streams download→upload through
 * this process, which is what makes the copy work across providers. Existing
 * destination keys are skipped, per-key failures don't abort the run.
 */
export async function copyEntriesAcross(
  from: Files,
  to: Files,
  targets: EntryTarget[],
  destPrefix: string,
): Promise<CrossCopyResult> {
  // Expand the selection into concrete (srcKey → destKey) pairs. Files land
  // directly in the destination folder; folders come along with their name.
  const pairs: { srcKey: string; destKey: string }[] = [];
  for (const target of targets) {
    if (target.kind === "file") {
      pairs.push({
        srcKey: target.key,
        destKey: destPrefix + basename(target.key),
      });
      continue;
    }
    const folderDest = `${destPrefix}${folderName(target.prefix)}/`;
    let cursor: string | undefined;
    do {
      const page = await from.list({
        prefix: target.prefix,
        cursor,
        limit: FOLDER_MOVE_LIST_BATCH,
      });
      for (const item of page.items) {
        if (item.key.endsWith("/")) continue; // folder markers
        pairs.push({
          srcKey: item.key,
          destKey: folderDest + item.key.slice(target.prefix.length),
        });
      }
      cursor = page.cursor;
      if (pairs.length > CROSS_COPY_MAX_OBJECTS) {
        const t = await getTranslations("browser.errors");
        return {
          error: t("selectionTooLargeToCopy", { max: CROSS_COPY_MAX_OBJECTS }),
        };
      }
    } while (cursor);
  }
  if (pairs.length > CROSS_COPY_MAX_OBJECTS) {
    const t = await getTranslations("browser.errors");
    return {
      error: t("selectionTooLargeToCopy", { max: CROSS_COPY_MAX_OBJECTS }),
    };
  }

  const summary: CrossCopySummary = { copied: 0, skipped: 0, failed: 0 };
  const copiedSrcKeys: string[] = [];
  for (let i = 0; i < pairs.length; i += CROSS_COPY_CONCURRENCY) {
    await Promise.all(
      pairs.slice(i, i + CROSS_COPY_CONCURRENCY).map(async (pair) => {
        try {
          if (await to.exists(pair.destKey)) {
            summary.skipped++;
            return;
          }
          const stored = await from.download(pair.srcKey);
          await to.upload(pair.destKey, stored.stream(), {
            contentType: stored.type || undefined,
          });
          summary.copied++;
          copiedSrcKeys.push(pair.srcKey);
        } catch (error) {
          summary.failed++;
          console.error(
            `[browser] cross-copy failed (${pair.srcKey} → ${pair.destKey}):`,
            error,
          );
        }
      }),
    );
  }
  return { summary, copiedSrcKeys };
}

/**
 * Deletes every object under a prefix (recursive listing, no delimiter),
 * including the zero-byte folder markers, in bulk batches. Re-lists from the
 * start after each batch since deletions shift pages. Returns an error
 * message, or null when the prefix is fully gone.
 */
export async function deletePrefix(
  files: Files,
  prefix: string,
): Promise<string | null> {
  for (let round = 0; round < DELETE_FOLDER_MAX_ROUNDS; round++) {
    const page = await files.list({ prefix, limit: DELETE_FOLDER_BATCH });
    if (page.items.length === 0) return null;
    const result = await files.delete(page.items.map((item) => item.key));
    if (result.errors?.length) {
      const t = await getTranslations("browser.errors");
      return t("objectsNotDeleted", { count: result.errors.length });
    }
    if (!page.cursor) return null;
  }
  const t = await getTranslations("browser.errors");
  return t("folderTooLargeToDelete");
}

export interface CrossMoveSummary {
  moved: number;
  skipped: number;
  failed: number;
}

export type CrossMoveResult = { error: string } | { summary: CrossMoveSummary };

/**
 * Cross-source move: copies a selection into another source (reusing the
 * cross-copy engine), then deletes from the origin ONLY the objects confirmed
 * copied. Objects that were skipped (already present at the destination) or
 * failed to copy are left untouched, so a partial run never loses data. A
 * failure to clean up the origin after a successful copy is logged but still
 * counts as "moved" (the object then exists on both sides — safe, not lost).
 */
export async function moveEntriesAcross(
  from: Files,
  to: Files,
  targets: EntryTarget[],
  destPrefix: string,
): Promise<CrossMoveResult> {
  const copy = await copyEntriesAcross(from, to, targets, destPrefix);
  if ("error" in copy) return { error: copy.error };

  let cleanupFailures = 0;
  for (let i = 0; i < copy.copiedSrcKeys.length; i += DELETE_FOLDER_BATCH) {
    const batch = copy.copiedSrcKeys.slice(i, i + DELETE_FOLDER_BATCH);
    try {
      const result = await from.delete(batch);
      if (result.errors?.length) cleanupFailures += result.errors.length;
    } catch (error) {
      cleanupFailures += batch.length;
      console.error("[browser] cross-move cleanup failed:", error);
    }
  }
  if (cleanupFailures > 0) {
    console.error(
      `[browser] cross-move left ${cleanupFailures} origin object(s) after copy`,
    );
  }

  return {
    summary: {
      moved: copy.summary.copied,
      skipped: copy.summary.skipped,
      failed: copy.summary.failed,
    },
  };
}
