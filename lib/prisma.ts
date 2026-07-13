import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Schema evolution is handled by real Prisma migrations (`prisma/migrations/`,
// applied with `prisma migrate deploy` on boot in production) — this module
// only opens the connection. There is no hand-written bootstrap DDL to keep in
// sync with the schema.
function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Point it at your PostgreSQL database, " +
        "e.g. postgresql://user:password@localhost:5432/bucket_ui",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Survive Turbopack HMR re-evaluation in dev without stacking connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
globalForPrisma.prisma ??= createClient();
export const prisma = globalForPrisma.prisma;
