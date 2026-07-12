"use server";

import { revalidatePath } from "next/cache";
import { getProvider } from "@/features/sources/providers";
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

function normalizeSourceInput(
  input: SourceInput
): { data: SourceInput; error?: never } | { data?: never; error: string } {
  const data: SourceInput = {
    name: String(input?.name ?? "").trim(),
    provider: String(input?.provider ?? "").trim(),
    endpoint: String(input?.endpoint ?? "").trim(),
    bucket: String(input?.bucket ?? "").trim(),
    accessKeyId: String(input?.accessKeyId ?? "").trim(),
    secretAccessKey: String(input?.secretAccessKey ?? "").trim(),
  };
  if (Object.values(data).some((value) => value === "")) {
    return { error: "All fields are required." };
  }
  if (!getProvider(data.provider)) {
    return { error: "Unknown provider." };
  }
  try {
    const url = new URL(data.endpoint);
    if (url.protocol !== "https:") throw new Error("not https");
    data.endpoint = url.origin;
  } catch {
    return { error: "Endpoint must be a valid https:// URL." };
  }
  return { data };
}

async function checkConnection(data: SourceInput): Promise<string | null> {
  try {
    await getFilesClient(data).list({ limit: 1 });
    return null;
  } catch {
    return "Connection failed — check the endpoint, bucket name and credentials.";
  }
}

export async function testSourceConnection(
  input: SourceInput
): Promise<ActionResult> {
  const normalized = normalizeSourceInput(input);
  if (normalized.error !== undefined) return { error: normalized.error };

  const connectionError = await checkConnection(normalized.data);
  return connectionError ? { error: connectionError } : { success: true };
}

export async function createSource(input: SourceInput): Promise<ActionResult> {
  const normalized = normalizeSourceInput(input);
  if (normalized.error !== undefined) return { error: normalized.error };

  const connectionError = await checkConnection(normalized.data);
  if (connectionError) return { error: connectionError };

  await dalCreateSource(normalized.data);
  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeSource(id: string): Promise<void> {
  await dalDeleteSource(id);
  revalidatePath("/", "layout");
}
