/**
 * Pure refresh decision for the versioned auth cache (see auth.ts). Kept in
 * its own module — no "server-only" import, no env/prisma dependency — so it
 * can be unit-tested without the full server bootstrap.
 */
export function shouldRefresh(
  cache: { version: number; checkedAt: number } | null,
  dbVersion: number | null,
  now: number,
  ttlMs: number,
): boolean {
  if (!cache) return true;
  if (now - cache.checkedAt < ttlMs) return false;
  return dbVersion !== null && dbVersion !== cache.version;
}
