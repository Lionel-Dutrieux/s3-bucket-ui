import "server-only";
import { prisma } from "@/lib/prisma";

export interface ShareInput {
  /** The public token (generateShareToken()). */
  id: string;
  sourceId: string;
  key: string;
  createdById: string;
  expiresAt: Date | null;
  passwordHash: string | null;
}

export async function createShare(input: ShareInput): Promise<void> {
  await prisma.share.create({ data: input });
}

/**
 * The public lookup: token → live share. Unknown, revoked and expired all
 * return null alike — public surfaces answer a uniform 404 from it.
 */
export async function getActiveShare(token: string) {
  const share = await prisma.share.findUnique({ where: { id: token } });
  if (!share) return null;
  if (share.revokedAt) return null;
  if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) return null;
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

export async function countShareDownload(id: string): Promise<void> {
  await prisma.share.update({
    where: { id },
    data: { downloads: { increment: 1 } },
  });
}
