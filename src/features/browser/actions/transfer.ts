"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  COPY_ENTRIES_MAX,
  MOVE_ENTRIES_MAX,
} from "@/features/browser/lib/limits";
import { basename, folderName, planMove } from "@/features/browser/lib/move";
import { entryTargetSchema } from "@/features/browser/lib/schemas";
import {
  type CrossCopySummary,
  type CrossMoveSummary,
  copyEntriesAcross,
  moveEntriesAcross,
  movePrefix,
} from "@/features/browser/server/mutations";
import { sourceAccessMiddleware } from "@/features/browser/server/source-access";
import { requireSourceAccess } from "@/lib/auth/access";
import { recordOperation } from "@/lib/dal/operations";
import { ActionError, actionClient } from "@/lib/safe-action";
import { getFilesClient } from "@/lib/storage/client";

/**
 * Copies a selection of files/folders into a folder of another (or the same)
 * source. Reading the origin needs a read grant (the middleware re-checks it);
 * writing the destination needs its edit capability — re-checked in the body,
 * with uniform 404-style messages so unreadable sources stay invisible.
 * Existing destination keys are skipped rather than overwritten; nothing is
 * removed from the origin.
 */
export const copyEntriesToSource = actionClient
  .metadata({
    actionName: "browser.copyEntriesToSource",
    failureKey: "browser.errors.copySelectionFailed",
  })
  .inputSchema(
    z.object({
      sourceId: z.string().min(1),
      destSourceId: z.string().min(1),
      targets: z.array(entryTargetSchema).min(1).max(COPY_ENTRIES_MAX),
      destPrefix: z.string(),
    }),
  )
  .useValidated(sourceAccessMiddleware({}))
  .action(
    async ({
      parsedInput: { destSourceId, targets, destPrefix },
      ctx: { source: origin, files: originFiles },
    }): Promise<CrossCopySummary> => {
      const t = await getTranslations("browser.errors");
      if (destPrefix !== "" && !destPrefix.endsWith("/")) {
        throw new ActionError(t("invalidDestination"));
      }

      const dest = await requireSourceAccess(destSourceId);
      if (!dest) throw new ActionError(t("destinationNotFound"));
      if (!dest.access.canEdit) throw new ActionError(t("addDeniedOther"));

      const result = await copyEntriesAcross(
        originFiles,
        getFilesClient(dest.source),
        targets,
        destPrefix,
      );
      if ("error" in result) throw new ActionError(result.error);

      const single = targets.length === 1 ? targets[0] : null;
      await recordOperation({
        action: "copy-to",
        sourceId: origin.id,
        sourceName: origin.name,
        target: single
          ? single.kind === "file"
            ? single.key
            : single.prefix
          : `${targets.length} items`,
        detail: `→ ${dest.source.name}:/${destPrefix}`,
      });
      return result.summary;
    },
  );

/**
 * Moves a selection of files/folders into `destPrefix` ("" = root). A move
 * keeps the content (copy + delete of the old key), so edit gates it. All-or-nothing on name
 * conflicts: if any destination is occupied, nothing moves.
 */
export const moveEntries = actionClient
  .metadata({
    actionName: "browser.moveEntries",
    failureKey: "browser.errors.moveFailure",
  })
  .inputSchema(
    z.object({
      sourceId: z.string().min(1),
      targets: z.array(entryTargetSchema).min(1).max(MOVE_ENTRIES_MAX),
      destPrefix: z.string(),
    }),
  )
  .useValidated(
    sourceAccessMiddleware({
      need: { edit: true },
      deniedKey: "browser.errors.editDenied",
    }),
  )
  .action(
    async ({
      parsedInput: { targets, destPrefix },
      ctx: { source, files },
    }) => {
      const t = await getTranslations("browser.errors");
      if (destPrefix !== "" && !destPrefix.endsWith("/")) {
        throw new ActionError(t("invalidDestination"));
      }

      const plan = planMove(targets, destPrefix);
      if (plan.error) throw new ActionError(t(plan.error));
      if (plan.moves.length === 0) return;

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
        throw new ActionError(
          t("destinationConflict", { names: conflicts.join(", ") }),
        );
      }

      for (const move of plan.moves) {
        if (move.kind === "file") {
          await files.move(move.from, move.to);
        } else {
          const result = await movePrefix(files, move.from, move.to);
          if (result.error) throw new ActionError(result.error);
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
    },
  );

/**
 * Moves a selection into a folder of ANOTHER source: copies each object across
 * (streaming through this process) then removes it from the origin. Editing
 * the origin AND the destination is required — a move destroys the origin, so
 * it needs more than the read grant a copy-to does. Non-destructive on partial
 * failure: only objects confirmed copied are removed from the origin.
 */
export const moveEntriesToSource = actionClient
  .metadata({
    actionName: "browser.moveEntriesToSource",
    failureKey: "browser.errors.moveFailure",
  })
  .inputSchema(
    z.object({
      sourceId: z.string().min(1),
      destSourceId: z.string().min(1),
      targets: z.array(entryTargetSchema).min(1).max(MOVE_ENTRIES_MAX),
      destPrefix: z.string(),
    }),
  )
  .useValidated(sourceAccessMiddleware({}))
  .action(
    async ({
      parsedInput: { sourceId, destSourceId, targets, destPrefix },
      ctx: { source: origin, files: originFiles, access },
    }): Promise<CrossMoveSummary> => {
      const t = await getTranslations("browser.errors");
      if (destPrefix !== "" && !destPrefix.endsWith("/")) {
        throw new ActionError(t("invalidDestination"));
      }

      // Same-source moves go through moveEntries (native, with the
      // self/descendant guard); this cross-source path must not run the
      // copy+delete engine inside one bucket. The dialog never calls it this
      // way — this rejects crafted requests.
      if (destSourceId === sourceId) {
        throw new ActionError(t("invalidDestination"));
      }

      // A move destroys the origin, so it needs the edit capability there too —
      // the middleware only re-checked the read grant.
      if (!access.canEdit) throw new ActionError(t("editDenied"));

      const dest = await requireSourceAccess(destSourceId);
      if (!dest) throw new ActionError(t("destinationNotFound"));
      if (!dest.access.canEdit) throw new ActionError(t("addDeniedOther"));

      const result = await moveEntriesAcross(
        originFiles,
        getFilesClient(dest.source),
        targets,
        destPrefix,
      );
      if ("error" in result) throw new ActionError(result.error);

      const single = targets.length === 1 ? targets[0] : null;
      await recordOperation({
        action: "move-to",
        sourceId: origin.id,
        sourceName: origin.name,
        target: single
          ? single.kind === "file"
            ? single.key
            : single.prefix
          : `${targets.length} items`,
        detail: `→ ${dest.source.name}:/${destPrefix}`,
      });
      return result.summary;
    },
  );
