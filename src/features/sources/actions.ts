"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  type SourceFormValues,
  sourceInputSchema,
  sourceUpdateSchema,
} from "@/features/sources/lib/schema";
import { testConnection } from "@/features/sources/server/connection";
import { transferSourceContents } from "@/features/sources/server/transfer";
import {
  createSource as dalCreateSource,
  deleteSource as dalDeleteSource,
  getSource as dalGetSource,
  updateSource as dalUpdateSource,
  type SourceInput,
} from "@/lib/dal/sources";
import { ActionError, adminActionClient } from "@/lib/safe-action";
import { checkLocalRoot } from "@/lib/storage/local-roots";
import { getProvider } from "@/lib/storage/providers";

type SourceErrorsT = Awaited<ReturnType<typeof getTranslations>>;

/**
 * Resolves edit-mode input into a full SourceInput: a blank secret falls back
 * to the one already stored for `sourceId`. Throws a translated ActionError on
 * any failure so callers can let it surface as the action's serverError.
 */
async function resolveUpdateInput(
  sourceId: string,
  input: SourceFormValues,
  t: SourceErrorsT,
): Promise<SourceInput> {
  const parsed = sourceUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ActionError(parsed.error.issues[0]?.message ?? t("invalidInput"));
  }

  const existing = await dalGetSource(sourceId);
  if (!existing) throw new ActionError(t("sourceNotFound"));

  return {
    ...parsed.data,
    secretAccessKey: parsed.data.secretAccessKey || existing.secretAccessKey,
  };
}

/**
 * Local (fs) sources only: re-validates the root path against the
 * LOCAL_FS_ROOTS allowlist and swaps in its canonical realpath — the client
 * never gets to pick an arbitrary server directory. Other providers pass
 * through untouched. Throws a translated ActionError when the root is rejected.
 */
async function guardLocalSource(
  data: SourceInput,
  t: SourceErrorsT,
): Promise<SourceInput> {
  if (getProvider(data.provider)?.adapter !== "fs") return data;
  const check = await checkLocalRoot(data.bucket);
  if (!check.ok) {
    const messages = {
      disabled: t("localDisabled"),
      outside: t("localRootNotAllowed"),
      unreachable: t("localRootUnreachable"),
    } as const;
    throw new ActionError(messages[check.reason]);
  }
  return { ...data, bucket: check.value };
}

export const testSourceConnection = adminActionClient
  .metadata({
    actionName: "sources.testSourceConnection",
    // Read-only probe; legacy never revalidated here.
    revalidate: false,
  })
  // sourceUpdateSchema is the more permissive of the two (a blank secret is
  // allowed), so it types both paths; the body refines exactly as before —
  // edit re-injects the stored secret, create re-parses with the strict schema.
  .inputSchema(
    z.object({
      sourceId: z.string().optional(),
      input: sourceUpdateSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    const t = await getTranslations("sources.errors");

    let data: SourceInput;
    if (parsedInput.sourceId) {
      data = await resolveUpdateInput(
        parsedInput.sourceId,
        parsedInput.input,
        t,
      );
    } else {
      const parsed = sourceInputSchema.safeParse(parsedInput.input);
      if (!parsed.success) {
        throw new ActionError(
          parsed.error.issues[0]?.message ?? t("invalidInput"),
        );
      }
      data = parsed.data;
    }

    const guarded = await guardLocalSource(data, t);

    if (!(await testConnection(guarded))) {
      throw new ActionError(t("connectionFailed"));
    }
  });

export const createSource = adminActionClient
  .metadata({ actionName: "sources.createSource" })
  .inputSchema(z.object({ input: sourceInputSchema }))
  .action(async ({ parsedInput }) => {
    const t = await getTranslations("sources.errors");

    const guarded = await guardLocalSource(parsedInput.input, t);

    if (!(await testConnection(guarded))) {
      throw new ActionError(t("connectionFailed"));
    }

    await dalCreateSource(guarded);
  });

export const updateSource = adminActionClient
  .metadata({ actionName: "sources.updateSource" })
  .inputSchema(
    z.object({
      sourceId: z.string().min(1),
      input: sourceUpdateSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    const t = await getTranslations("sources.errors");

    const resolved = await resolveUpdateInput(
      parsedInput.sourceId,
      parsedInput.input,
      t,
    );
    const guarded = await guardLocalSource(resolved, t);

    if (!(await testConnection(guarded))) {
      throw new ActionError(t("connectionFailed"));
    }

    await dalUpdateSource(parsedInput.sourceId, guarded);
  });

const migrationInputSchema = z.object({
  sourceId: z.uuid(),
  destId: z.uuid(),
});

export const copySourceContents = adminActionClient
  .metadata({
    actionName: "sources.copySourceContents",
    // Data transfer only; legacy never revalidated here.
    revalidate: false,
    failureKey: "sources.errors.migrationFailed",
  })
  .inputSchema(migrationInputSchema)
  .action(async ({ parsedInput }) => {
    const t = await getTranslations("sources.errors");
    const { sourceId, destId } = parsedInput;

    if (sourceId === destId) {
      throw new ActionError(t("sameSourceDestination"));
    }

    const [from, to] = await Promise.all([
      dalGetSource(sourceId),
      dalGetSource(destId),
    ]);
    if (!from || !to) throw new ActionError(t("sourceNotFound"));

    // Any unexpected transfer failure surfaces via metadata.failureKey.
    return transferSourceContents(from, to);
  });

export const removeSource = adminActionClient
  .metadata({
    actionName: "sources.removeSource",
    failureKey: "sources.errors.removeFailed",
  })
  .inputSchema(z.object({ id: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    await dalDeleteSource(parsedInput.id);
  });
