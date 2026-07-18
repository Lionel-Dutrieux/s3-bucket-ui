import "server-only";
import { isDropLive } from "@/lib/drops/validity";
import { prisma } from "@/lib/prisma";

export interface DropLinkInput {
  /** The public token (generateShareToken()). */
  id: string;
  sourceId: string;
  /** Destination prefix — "" (bucket root) or a folder prefix ending in "/". */
  prefix: string;
  createdById: string;
  expiresAt: Date | null;
  passwordHash: string | null;
  /** Deposit cap — null means unlimited. */
  maxFiles: number | null;
  /** Per-file size cap in MiB — null means only the global upload ceiling. */
  maxSizeMb: number | null;
  /** Free-text instruction shown to the guest — null when none. */
  note: string | null;
}

export async function createDropLink(input: DropLinkInput): Promise<void> {
  await prisma.dropLink.create({ data: input });
}

/**
 * The public lookup: token → live drop link. Unknown, revoked, expired and
 * links whose source has public sharing switched off all return null alike —
 * the deposit surfaces answer a uniform 404 from it. A source with
 * allowPublicShares=false kills every one of its links while it stays off.
 */
export async function getActiveDropLink(token: string) {
  const drop = await prisma.dropLink.findUnique({
    where: { id: token },
    include: { source: { select: { allowPublicShares: true } } },
  });
  if (!drop) return null;
  if (!drop.source.allowPublicShares) return null;
  if (!isDropLive(drop, new Date())) return null;
  return drop;
}

/** Management lookup — includes the source name (null once deleted). */
export async function getDropLinkWithSource(id: string) {
  return prisma.dropLink.findUnique({
    where: { id },
    include: { source: { select: { name: true } } },
  });
}

/** Owners see their links; admins see everyone's. */
export async function listDropLinksFor(viewer: {
  id: string;
  role?: string | null;
}) {
  return prisma.dropLink.findMany({
    where: viewer.role === "admin" ? {} : { createdById: viewer.id },
    include: { source: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeDropLink(id: string): Promise<void> {
  await prisma.dropLink.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

/**
 * Atomically reserves one deposit slot. Race-free: the conditional updateMany
 * only increments while the link is under its cap (or uncapped), so two
 * simultaneous uploads can never push past `maxFiles`. Returns false when the
 * cap was already reached — the caller then refuses the deposit. On a failed
 * upload the caller calls {@link releaseDropUploadSlot} to hand the slot back.
 */
export async function reserveDropUploadSlot(id: string): Promise<boolean> {
  const { count } = await prisma.dropLink.updateMany({
    where: {
      id,
      OR: [
        { maxFiles: null },
        { uploadsCount: { lt: prisma.dropLink.fields.maxFiles } },
      ],
    },
    data: { uploadsCount: { increment: 1 } },
  });
  return count > 0;
}

/** Hands a reserved slot back after an upload fails (never drops below 0). */
export async function releaseDropUploadSlot(id: string): Promise<void> {
  await prisma.dropLink.updateMany({
    where: { id, uploadsCount: { gt: 0 } },
    data: { uploadsCount: { decrement: 1 } },
  });
}
