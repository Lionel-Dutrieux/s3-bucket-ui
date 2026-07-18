import "server-only";
import { TtlCache } from "@/features/sources/lib/health-cache";
import { probeConnection } from "@/features/sources/server/connection";
import { getSource } from "@/lib/dal/sources";

export type SourceHealthStatus = "ok" | "error";

export interface SourceHealth {
  status: SourceHealthStatus;
  /** Probe round-trip in milliseconds. */
  latencyMs: number;
  /** Raw failure detail — admin-only, stripped before it reaches a non-admin
   *  client (it would leak endpoint/credential specifics otherwise). */
  error?: string;
}

// One process-wide cache, ~60 s TTL: probing a backend on every sidebar poll
// (every client, every minute) would hammer the storage endpoints. KISS — no
// table, no cron, just a module-scope map that self-expires.
const TTL_MS = 60_000;
const cache = new TtlCache<SourceHealth>(TTL_MS);

/**
 * Health of a single source, served from the TTL cache when fresh. A missing
 * source resolves to `error` (never cached — it should not exist for a caller
 * that already passed the access filter).
 */
export async function getSourceHealth(sourceId: string): Promise<SourceHealth> {
  const cached = cache.get(sourceId);
  if (cached) return cached;

  const source = await getSource(sourceId);
  if (!source) return { status: "error", latencyMs: 0 };

  const probe = await probeConnection(source);
  const health: SourceHealth = {
    status: probe.ok ? "ok" : "error",
    latencyMs: probe.latencyMs,
    error: probe.error,
  };
  cache.set(sourceId, health);
  return health;
}
