import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type OperationAction =
  | "upload"
  | "create-folder"
  | "delete"
  | "delete-folder"
  | "delete-many"
  | "rename"
  | "rename-folder";

export interface OperationRecord {
  id: string;
  action: string;
  sourceId: string | null;
  sourceName: string;
  target: string;
  detail: string | null;
  actor: string | null;
  createdAt: string;
}

// The app has no auth of its own, but the reverse proxy in front of it may
// forward the authenticated identity. Read it best-effort to attribute
// operations; absent means the proxy doesn't set it.
const ACTOR_HEADERS = [
  "x-forwarded-user",
  "x-forwarded-preferred-username",
  "x-forwarded-email",
  "remote-user",
];

async function currentActor(): Promise<string | null> {
  try {
    const headerList = await headers();
    for (const name of ACTOR_HEADERS) {
      const value = headerList.get(name);
      if (value) return value;
    }
  } catch {
    // headers() throws outside a request scope — no actor then.
  }
  return null;
}

/**
 * Appends one row to the audit trail. Never throws: a failure to log must not
 * fail the write it records, so errors are swallowed after logging.
 */
export async function recordOperation(input: {
  action: OperationAction;
  sourceId: string;
  sourceName: string;
  target: string;
  detail?: string;
}): Promise<void> {
  try {
    await prisma.operation.create({
      data: {
        action: input.action,
        sourceId: input.sourceId,
        sourceName: input.sourceName,
        target: input.target,
        detail: input.detail,
        actor: await currentActor(),
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
