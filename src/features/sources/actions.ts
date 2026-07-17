"use server";

import { transfer } from "files-sdk";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  type SourceFormValues,
  sourceInputSchema,
  sourceUpdateSchema,
} from "@/features/sources/lib/schema";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { currentAdmin } from "@/lib/auth/session";
import { recordOperation } from "@/lib/dal/operations";
import {
  createSource as dalCreateSource,
  deleteSource as dalDeleteSource,
  getSource as dalGetSource,
  updateSource as dalUpdateSource,
  type SourceInput,
} from "@/lib/dal/sources";
import { getFilesClient } from "@/lib/storage/client";

type SourceErrorsT = Awaited<ReturnType<typeof getTranslations>>;

async function checkConnection(
  data: SourceInput,
  t: SourceErrorsT,
): Promise<string | null> {
  try {
    await getFilesClient(data).list({ limit: 1 });
    return null;
  } catch (error) {
    console.error(
      `[sources] connection test failed (provider=${data.provider}, endpoint=${data.endpoint}, bucket=${data.bucket}):`,
      error,
    );
    return t("connectionFailed");
  }
}

/**
 * Resolves edit-mode input into a full SourceInput: a blank secret falls back
 * to the one already stored for `sourceId`.
 */
async function resolveUpdateInput(
  sourceId: string,
  input: SourceFormValues,
  t: SourceErrorsT,
): Promise<{ data?: SourceInput; error?: string }> {
  const parsed = sourceUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }

  const existing = await dalGetSource(sourceId);
  if (!existing) return { error: t("sourceNotFound") };

  return {
    data: {
      ...parsed.data,
      secretAccessKey: parsed.data.secretAccessKey || existing.secretAccessKey,
    },
  };
}

export async function testSourceConnection(
  input: SourceFormValues,
  sourceId?: string,
): Promise<ActionResult> {
  const t = await getTranslations("sources.errors");
  if (!(await currentAdmin())) return actionError(t("notAuthorized"));

  let data: SourceInput;
  if (sourceId) {
    const resolved = await resolveUpdateInput(sourceId, input, t);
    if (!resolved.data) {
      return actionError(resolved.error ?? t("invalidInput"));
    }
    data = resolved.data;
  } else {
    const parsed = sourceInputSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? t("invalidInput"));
    }
    data = parsed.data;
  }

  const connectionError = await checkConnection(data, t);
  return connectionError ? actionError(connectionError) : actionOk();
}

export async function createSource(
  input: SourceFormValues,
): Promise<ActionResult> {
  const t = await getTranslations("sources.errors");
  if (!(await currentAdmin())) return actionError(t("notAuthorized"));

  const parsed = sourceInputSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? t("invalidInput"));
  }

  const connectionError = await checkConnection(parsed.data, t);
  if (connectionError) return actionError(connectionError);

  await dalCreateSource(parsed.data);
  revalidatePath("/", "layout");
  return actionOk();
}

export async function updateSource(
  sourceId: string,
  input: SourceFormValues,
): Promise<ActionResult> {
  const t = await getTranslations("sources.errors");
  if (!(await currentAdmin())) return actionError(t("notAuthorized"));

  const resolved = await resolveUpdateInput(sourceId, input, t);
  if (!resolved.data) return actionError(resolved.error ?? t("invalidInput"));

  const connectionError = await checkConnection(resolved.data, t);
  if (connectionError) return actionError(connectionError);

  await dalUpdateSource(sourceId, resolved.data);
  revalidatePath("/", "layout");
  return actionOk();
}

export interface MigrationSummary {
  transferred: number;
  skipped: number;
  failed: number;
}

const migrationInputSchema = z.object({
  sourceId: z.uuid(),
  destId: z.uuid(),
});

/**
 * Copies every object of one source into another — files-sdk's transfer()
 * streams each body download-to-upload, so this works across providers
 * (S3 → Azure, R2 → S3, …) without buffering. Existing destination keys are
 * skipped, the source is never modified, and per-key failures don't abort
 * the run: the summary reports transferred / skipped / failed counts.
 */
export async function copySourceContents(
  sourceId: string,
  destId: string,
): Promise<ActionResult<MigrationSummary>> {
  const t = await getTranslations("sources.errors");
  if (!(await currentAdmin())) return actionError(t("notAuthorized"));
  const parsed = migrationInputSchema.safeParse({ sourceId, destId });
  if (!parsed.success) return actionError(t("invalidSource"));
  if (sourceId === destId) {
    return actionError(t("sameSourceDestination"));
  }

  const [from, to] = await Promise.all([
    dalGetSource(sourceId),
    dalGetSource(destId),
  ]);
  if (!from || !to) return actionError(t("sourceNotFound"));

  try {
    const result = await transfer(getFilesClient(from), getFilesClient(to), {
      overwrite: false, // never clobber what the destination already holds
    });
    const summary: MigrationSummary = {
      transferred: result.transferred.length,
      skipped: result.skipped?.length ?? 0,
      failed: result.errors?.length ?? 0,
    };
    if (result.errors?.length) {
      console.error(
        `[sources] migration ${from.name} → ${to.name}: ${result.errors.length} failed`,
        result.errors.slice(0, 5),
      );
    }
    await recordOperation({
      action: "migrate",
      sourceId: from.id,
      sourceName: from.name,
      target: `→ ${to.name}`,
      detail: `${summary.transferred} copied, ${summary.skipped} skipped${summary.failed ? `, ${summary.failed} failed` : ""}`,
    });
    return actionOk(summary);
  } catch (error) {
    console.error(
      `[sources] migration failed (${from.name} → ${to.name}):`,
      error,
    );
    return actionError(t("migrationFailed"));
  }
}

export async function removeSource(id: string): Promise<ActionResult> {
  const t = await getTranslations("sources.errors");
  if (!(await currentAdmin())) return actionError(t("notAuthorized"));

  try {
    await dalDeleteSource(id);
  } catch (error) {
    console.error(`[sources] remove failed (source=${id}):`, error);
    return actionError(t("removeFailed"));
  }
  revalidatePath("/", "layout");
  return actionOk();
}
