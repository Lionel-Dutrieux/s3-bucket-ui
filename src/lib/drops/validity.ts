// Pure validity logic for a drop (reverse-share) link, shared by the DAL
// lookup, the public deposit page and the management table. No I/O so Vitest
// can import it directly. Mirrors lib/shares/validity.ts.

export interface DropValidity {
  revokedAt: Date | null;
  expiresAt: Date | null;
  uploadsCount: number;
  /** null = unlimited deposits. */
  maxFiles: number | null;
}

/** True once a capped link has taken (or is taking) its last deposit. */
export function isFileLimitReached(
  uploadsCount: number,
  maxFiles: number | null,
): boolean {
  return maxFiles !== null && uploadsCount >= maxFiles;
}

/**
 * A drop link is live for VIEWING unless it was revoked or has passed its
 * expiry. The file cap is deliberately NOT a validity gate: a full link still
 * renders (so the guest sees a clear "no more room" message) — the upload
 * route is what refuses the deposit itself. Revocation and expiry are the same
 * uniform 404 as a share.
 */
export function isDropLive(drop: DropValidity, now: Date): boolean {
  if (drop.revokedAt) return false;
  if (drop.expiresAt && drop.expiresAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}
