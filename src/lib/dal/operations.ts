import "server-only";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type OperationAction =
  | "upload"
  | "create-folder"
  | "delete"
  | "delete-folder"
  | "delete-many"
  | "rename"
  | "rename-folder"
  | "move";

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

export async function listOperations(
  filters: OperationFilters = {},
  limit = 200,
): Promise<OperationRecord[]> {
  const { action, sourceName, q } = filters;
  return prisma.operation.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(sourceName ? { sourceName } : {}),
      ...(q
        ? {
            OR: [
              { target: { contains: q, mode: "insensitive" } },
              { detail: { contains: q, mode: "insensitive" } },
              { actor: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
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
