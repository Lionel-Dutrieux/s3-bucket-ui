import "server-only";
import type { SourceInput } from "@/lib/dal/sources";
import { getFilesClient } from "@/lib/storage/client";

export interface ConnectionProbe {
  ok: boolean;
  /** Round-trip time of the probe list call, in milliseconds. */
  latencyMs: number;
  /** Raw failure detail — endpoint-revealing, admin-only, never sent to a
   *  non-admin client. */
  error?: string;
}

/**
 * Probes a source's credentials with a single-object list. Returns the outcome
 * with latency and (on failure) the raw error, so callers can surface a
 * translated message or an admin-only detail. Logs failures server-side.
 */
export async function probeConnection(
  data: SourceInput,
): Promise<ConnectionProbe> {
  const startedAt = Date.now();
  try {
    await getFilesClient(data).list({ limit: 1 });
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    console.error(
      `[sources] connection test failed (provider=${data.provider}, endpoint=${data.endpoint}, bucket=${data.bucket}):`,
      error,
    );
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Boolean flavour used by the create/edit source actions: true when the
 * connection succeeds, false otherwise.
 */
export async function testConnection(data: SourceInput): Promise<boolean> {
  return (await probeConnection(data)).ok;
}
