import "server-only";
import { prisma } from "@/lib/prisma";

/** Connectivity probe for the health endpoint — throws when the database
 *  is unreachable. */
export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
