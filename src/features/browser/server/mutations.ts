import "server-only";
import type { Files } from "files-sdk";
import {
  DELETE_FOLDER_BATCH,
  DELETE_FOLDER_MAX_ROUNDS,
  FOLDER_MOVE_CONCURRENCY,
  FOLDER_MOVE_LIST_BATCH,
  FOLDER_MOVE_MAX_OBJECTS,
} from "@/features/browser/lib/limits";

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
      return `${result.errors.length} object${result.errors.length === 1 ? "" : "s"} could not be deleted.`;
    }
    if (!page.cursor) return null;
  }
  return "This folder is too large to delete in one go — some objects remain, run it again.";
}
