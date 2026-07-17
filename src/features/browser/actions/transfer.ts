"use server";

import { getTranslations } from "next-intl/server";
import {
  COPY_ENTRIES_MAX,
  MOVE_ENTRIES_MAX,
} from "@/features/browser/lib/limits";
import {
  basename,
  type EntryTarget,
  folderName,
  planMove,
} from "@/features/browser/lib/move";
import { withWriteAccess } from "@/features/browser/server/guards";
import {
  type CrossCopySummary,
  type CrossMoveSummary,
  copyEntriesAcross,
  moveEntriesAcross,
  movePrefix,
} from "@/features/browser/server/mutations";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { requireSourceAccess } from "@/lib/auth/access";
import { recordOperation } from "@/lib/dal/operations";
import { getFilesClient } from "@/lib/storage/client";

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
  const t = await getTranslations("browser.errors");
  if (destPrefix !== "" && !destPrefix.endsWith("/")) {
    return actionError(t("invalidDestination"));
  }
  if (targets.length === 0) return actionError(t("nothingSelected"));
  if (targets.length > COPY_ENTRIES_MAX) {
    return actionError(t("copyAtMost", { max: COPY_ENTRIES_MAX }));
  }
  if (
    targets.some(
      (target) => target.kind === "folder" && !target.prefix.endsWith("/"),
    )
  ) {
    return actionError(t("invalidFolder"));
  }

  const origin = await requireSourceAccess(sourceId);
  if (!origin) return actionError(t("sourceNotFound"));
  const dest = await requireSourceAccess(destSourceId);
  if (!dest) return actionError(t("destinationNotFound"));
  if (!dest.access.canEdit) {
    return actionError(t("addDeniedOther"));
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
    return actionError(t("copySelectionFailed"));
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
  const t = await getTranslations("browser.errors");
  if (destPrefix !== "" && !destPrefix.endsWith("/")) {
    return actionError(t("invalidDestination"));
  }
  if (targets.length === 0) return actionOk();
  if (targets.length > MOVE_ENTRIES_MAX) {
    return actionError(t("moveAtMost", { max: MOVE_ENTRIES_MAX }));
  }
  if (
    targets.some(
      (target) => target.kind === "folder" && !target.prefix.endsWith("/"),
    )
  ) {
    return actionError(t("invalidFolder"));
  }

  const plan = planMove(targets, destPrefix);
  if (plan.error) return actionError(t(plan.error));
  if (plan.moves.length === 0) return actionOk();

  return withWriteAccess(
    sourceId,
    {
      need: { edit: true },
      denied: t("editDenied"),
      action: "move the selection",
      failureMessage: t("moveFailure"),
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
          t("destinationConflict", { names: conflicts.join(", ") }),
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

/**
 * Moves a selection into a folder of ANOTHER source: copies each object across
 * (streaming through this process) then removes it from the origin. Editing
 * the origin AND the destination is required — a move destroys the origin, so
 * it needs more than the read grant a copy-to does. Non-destructive on partial
 * failure: only objects confirmed copied are removed from the origin.
 */
export async function moveEntriesToSource(
  sourceId: string,
  destSourceId: string,
  targets: EntryTarget[],
  destPrefix: string,
): Promise<ActionResult<CrossMoveSummary>> {
  const t = await getTranslations("browser.errors");
  if (destPrefix !== "" && !destPrefix.endsWith("/")) {
    return actionError(t("invalidDestination"));
  }
  if (targets.length === 0) return actionError(t("nothingSelected"));
  if (targets.length > MOVE_ENTRIES_MAX) {
    return actionError(t("moveAtMost", { max: MOVE_ENTRIES_MAX }));
  }
  if (
    targets.some(
      (target) => target.kind === "folder" && !target.prefix.endsWith("/"),
    )
  ) {
    return actionError(t("invalidFolder"));
  }

  // Same-source moves go through moveEntries (native, with the self/descendant
  // guard); this cross-source path must not run the copy+delete engine inside
  // one bucket. The dialog never calls it this way — this rejects crafted requests.
  if (destSourceId === sourceId) {
    return actionError(t("invalidDestination"));
  }

  const origin = await requireSourceAccess(sourceId);
  if (!origin) return actionError(t("sourceNotFound"));
  if (!origin.access.canEdit) return actionError(t("editDenied"));
  const dest = await requireSourceAccess(destSourceId);
  if (!dest) return actionError(t("destinationNotFound"));
  if (!dest.access.canEdit) return actionError(t("addDeniedOther"));

  try {
    const result = await moveEntriesAcross(
      getFilesClient(origin.source),
      getFilesClient(dest.source),
      targets,
      destPrefix,
    );
    if ("error" in result) return actionError(result.error);

    const single = targets.length === 1 ? targets[0] : null;
    await recordOperation({
      action: "move-to",
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
      `[browser] cross-move failed (source=${sourceId} → ${destSourceId}):`,
      error,
    );
    return actionError(t("moveFailure"));
  }
}
