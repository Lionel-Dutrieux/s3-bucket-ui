"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  type SourceFormValues,
  sourceInputSchema,
  sourceUpdateSchema,
} from "@/features/sources/lib/schema";
import { testConnection } from "@/features/sources/server/connection";
import {
  type MigrationSummary,
  transferSourceContents,
} from "@/features/sources/server/transfer";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { currentAdmin } from "@/lib/auth/session";
import {
  createSource as dalCreateSource,
  deleteSource as dalDeleteSource,
  getSource as dalGetSource,
  updateSource as dalUpdateSource,
  type SourceInput,
} from "@/lib/dal/sources";
import { checkLocalRoot } from "@/lib/storage/local-roots";
import { getProvider } from "@/lib/storage/providers";

type SourceErrorsT = Awaited<ReturnType<typeof getTranslations>>;

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

/**
 * Local (fs) sources only: re-validates the root path against the
 * LOCAL_FS_ROOTS allowlist and swaps in its canonical realpath — the client
 * never gets to pick an arbitrary server directory. Other providers pass
 * through untouched.
 */
async function guardLocalSource(
  data: SourceInput,
  t: SourceErrorsT,
): Promise<{ data?: SourceInput; error?: string }> {
  if (getProvider(data.provider)?.adapter !== "fs") return { data };
  const check = await checkLocalRoot(data.bucket);
  if (!check.ok) {
    const messages = {
      disabled: t("localDisabled"),
      outside: t("localRootNotAllowed"),
      unreachable: t("localRootUnreachable"),
    } as const;
    return { error: messages[check.reason] };
  }
  return { data: { ...data, bucket: check.value } };
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

  const guarded = await guardLocalSource(data, t);
  if (!guarded.data) return actionError(guarded.error ?? t("invalidInput"));

  return (await testConnection(guarded.data))
    ? actionOk()
    : actionError(t("connectionFailed"));
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

  const guarded = await guardLocalSource(parsed.data, t);
  if (!guarded.data) return actionError(guarded.error ?? t("invalidInput"));

  if (!(await testConnection(guarded.data))) {
    return actionError(t("connectionFailed"));
  }

  await dalCreateSource(guarded.data);
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

  const guarded = await guardLocalSource(resolved.data, t);
  if (!guarded.data) return actionError(guarded.error ?? t("invalidInput"));

  if (!(await testConnection(guarded.data))) {
    return actionError(t("connectionFailed"));
  }

  await dalUpdateSource(sourceId, guarded.data);
  revalidatePath("/", "layout");
  return actionOk();
}

const migrationInputSchema = z.object({
  sourceId: z.uuid(),
  destId: z.uuid(),
});

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
    return actionOk(await transferSourceContents(from, to));
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
