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

export async function listOperations(limit = 200): Promise<OperationRecord[]> {
  return prisma.operation.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
