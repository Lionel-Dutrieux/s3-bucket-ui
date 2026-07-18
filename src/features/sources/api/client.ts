// Client-side access to the sources feature's read endpoints. Reads never go
// through server actions: the sidebar health pastille consumes this GET route
// through TanStack Query. The fetcher throws on failure (with the route's error
// message) so the query error state carries something to render.

export type SourceHealthStatus = "ok" | "error";

/** One source's health as seen by the client. `latencyMs`/`error` are present
 *  only for admins (the route strips them for regular users). */
export interface SourceHealthEntry {
  status: SourceHealthStatus;
  latencyMs?: number;
  error?: string;
}

export type SourceHealthMap = Record<string, SourceHealthEntry>;

async function getJson<T extends { error?: string }>(
  url: string,
  fallback: string,
): Promise<T> {
  let body: T | null = null;
  try {
    const response = await fetch(url);
    body = (await response.json()) as T;
  } catch {
    throw new Error(fallback);
  }
  if (body?.error) throw new Error(body.error);
  return body;
}

export async function fetchSourceHealth(): Promise<SourceHealthMap> {
  const result = await getJson<{
    health?: SourceHealthMap;
    error?: string;
  }>("/api/sources/health", "Could not check source health.");
  return result.health ?? {};
}
