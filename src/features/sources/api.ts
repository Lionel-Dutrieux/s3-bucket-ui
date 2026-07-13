// Client-side access to the source config endpoint (app/source/[id]/config).
// Reads never go through server actions; the edit dialog fetches the full
// record (minus the secret) on demand, through TanStack Query. The fetcher
// throws on failure so query error states carry the message.

import type { SourceInput } from "@/lib/dal/sources";

export type SourceConfig = Omit<SourceInput, "secretAccessKey">;

export interface SourceConfigResult {
  source?: SourceConfig;
  error?: string;
}

export async function fetchSourceConfig(
  sourceId: string,
): Promise<SourceConfig> {
  const fallback = "Couldn't load this source.";
  let result: SourceConfigResult;
  try {
    const response = await fetch(`/source/${sourceId}/config`);
    result = (await response.json()) as SourceConfigResult;
  } catch {
    throw new Error(fallback);
  }
  if (!result.source) throw new Error(result.error ?? fallback);
  return result.source;
}
