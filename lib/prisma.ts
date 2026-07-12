import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";

function createClient(): PrismaClient {
  const dataDir = path.join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  const adapter = new PrismaBetterSqlite3({
    url: `file:${path.join(dataDir, "app.db")}`,
  });
  return new PrismaClient({ adapter });
}

// Survive Turbopack HMR re-evaluation in dev without stacking connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = (globalForPrisma.prisma ??= createClient());
