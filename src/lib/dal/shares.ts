import "server-only";
import { prisma } from "@/lib/prisma";
import { isShareLive } from "@/lib/shares/validity";

export interface ShareInput {
  /** The public token (generateShareToken()). */
  id: string;
  sourceId: string;
  key: string;
  createdById: string;
  expiresAt: Date | null;
  passwordHash: string | null;
  /** Download cap — null means unlimited. */
  maxDownloads: number | null;
}

export async function createShare(input: ShareInput): Promise<void> {
  await prisma.share.create({ data: input });
}

/**
 * The public lookup: token → live share. Unknown, revoked, expired and links
 * whose source has public sharing switched off all return null alike — public
 * surfaces answer a uniform 404 from it. A source with allowPublicShares=false
 * kills every one of its links for as long as it stays off.
 */
export async function getActiveShare(token: string) {
  const share = await prisma.share.findUnique({
    where: { id: token },
    include: { source: { select: { allowPublicShares: true } } },
  });
  if (!share) return null;
  if (!share.source.allowPublicShares) return null;
  if (!isShareLive(share, new Date())) return null;
  return share;
}

/** Management lookup — includes the source name (null once deleted). */
export async function getShareWithSource(id: string) {
  return prisma.share.findUnique({
    where: { id },
    include: { source: { select: { name: true } } },
  });
}

/** Owners see their links; admins see everyone's. */
export async function listSharesFor(viewer: {
  id: string;
  role?: string | null;
}) {
  return prisma.share.findMany({
    where: viewer.role === "admin" ? {} : { createdById: viewer.id },
    include: { source: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeShare(id: string): Promise<void> {
  await prisma.share.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

/**
 * Atomically records one download. Race-free: the conditional updateMany only
 * increments while the link is under its cap (or uncapped), so two simultaneous
 * downloads can never push past the limit. Returns false when the cap was
 * already reached — the caller then answers 404, same as an expired link.
 */
export async function countShareDownload(id: string): Promise<boolean> {
  const { count } = await prisma.share.updateMany({
    where: {
      id,
      OR: [
        { maxDownloads: null },
        { downloads: { lt: prisma.share.fields.maxDownloads } },
      ],
    },
    data: { downloads: { increment: 1 } },
  });
  return count > 0;
}
