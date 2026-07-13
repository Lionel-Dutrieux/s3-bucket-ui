"use server";

import { revalidatePath } from "next/cache";
import {
  type SourceFormValues,
  sourceInputSchema,
  sourceUpdateSchema,
} from "@/features/sources/lib/schema";
import { getFilesClient } from "@/features/sources/server/storage";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import {
  createSource as dalCreateSource,
  deleteSource as dalDeleteSource,
  getSource as dalGetSource,
  updateSource as dalUpdateSource,
  type SourceInput,
} from "@/lib/dal/sources";

async function checkConnection(data: SourceInput): Promise<string | null> {
  try {
    await getFilesClient(data).list({ limit: 1 });
    return null;
  } catch (error) {
    console.error(
      `[sources] connection test failed (provider=${data.provider}, endpoint=${data.endpoint}, bucket=${data.bucket}):`,
      error,
    );
    return "Connection failed — check the endpoint, bucket name and credentials.";
  }
}

/**
 * Resolves edit-mode input into a full SourceInput: a blank secret falls back
 * to the one already stored for `sourceId`.
 */
async function resolveUpdateInput(
  sourceId: string,
  input: SourceFormValues,
): Promise<{ data?: SourceInput; error?: string }> {
  const parsed = sourceUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const existing = await dalGetSource(sourceId);
  if (!existing) return { error: "Source not found." };

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
  let data: SourceInput;
  if (sourceId) {
    const resolved = await resolveUpdateInput(sourceId, input);
    if (!resolved.data) {
      return actionError(resolved.error ?? "Invalid input.");
    }
    data = resolved.data;
  } else {
    const parsed = sourceInputSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    data = parsed.data;
  }

  const connectionError = await checkConnection(data);
  return connectionError ? actionError(connectionError) : actionOk();
}

export async function createSource(
  input: SourceFormValues,
): Promise<ActionResult> {
  const parsed = sourceInputSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const connectionError = await checkConnection(parsed.data);
  if (connectionError) return actionError(connectionError);

  await dalCreateSource(parsed.data);
  revalidatePath("/", "layout");
  return actionOk();
}

export async function updateSource(
  sourceId: string,
  input: SourceFormValues,
): Promise<ActionResult> {
  const resolved = await resolveUpdateInput(sourceId, input);
  if (!resolved.data) return actionError(resolved.error ?? "Invalid input.");

  const connectionError = await checkConnection(resolved.data);
  if (connectionError) return actionError(connectionError);

  await dalUpdateSource(sourceId, resolved.data);
  revalidatePath("/", "layout");
  return actionOk();
}

export async function removeSource(id: string): Promise<ActionResult> {
  try {
    await dalDeleteSource(id);
  } catch (error) {
    console.error(`[sources] remove failed (source=${id}):`, error);
    return actionError("Could not remove this source.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}
