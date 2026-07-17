import "server-only";
import { getSession } from "@/lib/auth/session";
import {
  getAuditLastPurgeAt,
  getAuditRetentionDays,
  setAuditLastPurgeAt,
} from "@/lib/dal/settings";
import { prisma } from "@/lib/prisma";

const MS_PER_DAY = 86_400_000;
const PURGE_THROTTLE_MS = 24 * 60 * 60 * 1000;

export type OperationAction =
  | "upload"
  | "create-folder"
  | "delete"
  | "delete-folder"
  | "delete-many"
  | "rename"
  | "rename-folder"
  | "move"
  | "move-to"
  | "copy"
  | "copy-to"
  | "migrate"
  | "share-create"
  | "share-revoke"
  | "download"
  | "download-zip"
  | "share-download";

export interface OperationRecord {
  id: string;
  action: string;
  sourceId: string | null;
  sourceName: string;
  target: string;
  detail: string | null;
  actor: string | null;
  userId: string | null;
  createdAt: Date;
}

/**
 * Appends one row to the audit trail, attributed to the session user (email
 * denormalized so history stays readable after an account is deleted). Never
 * throws: a failure to log must not fail the write it records.
 */
export async function recordOperation(input: {
  action: OperationAction;
  sourceId: string;
  sourceName: string;
  target: string;
  detail?: string;
}): Promise<void> {
  try {
    const session = await getSession();
    await prisma.operation.create({
      data: {
        action: input.action,
        sourceId: input.sourceId,
        sourceName: input.sourceName,
        target: input.target,
        detail: input.detail,
        actor: session?.user.email ?? null,
        userId: session?.user.id ?? null,
      },
    });
  } catch (error) {
    console.error("[operations] failed to record:", error);
  }
}

export interface OperationFilters {
  /** Exact action id (e.g. "upload", "move", "sign-in-failed"). */
  action?: string;
  /** Exact denormalized source name. */
  sourceName?: string;
  /** Case-insensitive substring over target, detail and actor. */
  q?: string;
}

function buildOperationWhere(filters: OperationFilters) {
  const { action, sourceName, q } = filters;
  return {
    ...(action ? { action } : {}),
    ...(sourceName ? { sourceName } : {}),
    ...(q
      ? {
          OR: [
            { target: { contains: q, mode: "insensitive" as const } },
            { detail: { contains: q, mode: "insensitive" as const } },
            { actor: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export async function listOperations(
  filters: OperationFilters = {},
  limit = 200,
): Promise<OperationRecord[]> {
  return prisma.operation.findMany({
    where: buildOperationWhere(filters),
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Full export for the audit log download (CSV/JSON) — same filters as
 * `listOperations` but capped high rather than at the UI page size.
 */
export async function exportOperations(
  filters: OperationFilters = {},
): Promise<OperationRecord[]> {
  return prisma.operation.findMany({
    where: buildOperationWhere(filters),
    orderBy: { createdAt: "desc" },
    take: 50_000,
  });
}

/**
 * Lazy retention purge: deletes audit rows older than the configured
 * retention window, throttled to once per day. A no-op when retention is
 * unset (keep forever). Never throws — a failed purge must not break the
 * activity view that triggers it.
 */
export async function purgeExpiredOperations(): Promise<void> {
  try {
    const days = await getAuditRetentionDays();
    if (days <= 0) return;

    const now = Date.now();
    const lastPurge = await getAuditLastPurgeAt();
    if (lastPurge !== null && now - lastPurge < PURGE_THROTTLE_MS) return;

    const cutoff = new Date(now - days * MS_PER_DAY);
    await prisma.operation.deleteMany({ where: { createdAt: { lt: cutoff } } });
    await setAuditLastPurgeAt(now);
  } catch (error) {
    console.error("[operations] failed to purge expired entries:", error);
  }
}

/** Distinct source names seen in the log — includes since-removed sources. */
export async function listOperationSourceNames(): Promise<string[]> {
  const rows = await prisma.operation.findMany({
    distinct: ["sourceName"],
    select: { sourceName: true },
    orderBy: { sourceName: "asc" },
  });
  return rows.map((row) => row.sourceName);
}
