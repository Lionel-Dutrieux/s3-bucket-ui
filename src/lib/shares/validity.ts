// Pure validity logic for a share link, shared by the DAL lookup, the public
// viewer and the management table. No I/O so Vitest can import it directly.

export interface ShareValidity {
  revokedAt: Date | null;
  expiresAt: Date | null;
  downloads: number;
  /** null = unlimited. */
  maxDownloads: number | null;
}

/** True once a capped link has served (or is serving) its last download. */
export function isDownloadLimitReached(
  downloads: number,
  maxDownloads: number | null,
): boolean {
  return maxDownloads !== null && downloads >= maxDownloads;
}

/**
 * A link is live unless it was revoked, has passed its expiry, or hit its
 * download cap. Exhaustion and expiry are treated identically — the same 404.
 */
export function isShareLive(share: ShareValidity, now: Date): boolean {
  if (share.revokedAt) return false;
  if (share.expiresAt && share.expiresAt.getTime() <= now.getTime()) {
    return false;
  }
  if (isDownloadLimitReached(share.downloads, share.maxDownloads)) return false;
  return true;
}
