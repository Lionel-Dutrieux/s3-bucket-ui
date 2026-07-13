import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

// Schema evolution is handled by real Prisma migrations (`prisma/migrations/`,
// applied with `prisma migrate deploy` on boot in production) — this module
// only opens the connection. There is no hand-written bootstrap DDL to keep in
// sync with the schema.
function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// The connection is created lazily, on first use — never at import time. That
// keeps `next build` (which imports this module while collecting page data but
// never runs a query) from needing a database. Survives Turbopack HMR
// re-evaluation in dev without stacking connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createClient();
    }
    const client = globalForPrisma.prisma;
    return Reflect.get(client, property, client);
  },
});
