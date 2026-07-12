"use server";

import { revalidatePath } from "next/cache";
import { sourceInputSchema, type SourceFormValues } from "@/features/sources/schema";
import { getFilesClient } from "@/features/sources/storage";
import {
  createSource as dalCreateSource,
  deleteSource as dalDeleteSource,
  type SourceInput,
} from "@/lib/dal/sources";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

async function checkConnection(data: SourceInput): Promise<string | null> {
  try {
    await getFilesClient(data).list({ limit: 1 });
    return null;
  } catch (error) {
    console.error(
      `[sources] connection test failed (provider=${data.provider}, endpoint=${data.endpoint}, bucket=${data.bucket}):`,
      error
    );
    return "Connection failed — check the endpoint, bucket name and credentials.";
  }
}

export async function testSourceConnection(
  input: SourceFormValues
): Promise<ActionResult> {
  const parsed = sourceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const connectionError = await checkConnection(parsed.data);
  return connectionError ? { error: connectionError } : { success: true };
}

export async function createSource(
  input: SourceFormValues
): Promise<ActionResult> {
  const parsed = sourceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const connectionError = await checkConnection(parsed.data);
  if (connectionError) return { error: connectionError };

  await dalCreateSource(parsed.data);
  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeSource(id: string): Promise<void> {
  await dalDeleteSource(id);
  revalidatePath("/", "layout");
}
