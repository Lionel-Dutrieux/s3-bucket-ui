import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Bootstrap DDL so a fresh database (first boot, empty Docker volume) works
// without a deploy step. MUST stay in sync with prisma/schema.prisma — for
// schema evolutions, prefer `pnpm db:push` in dev and add idempotent
// statements here for production.
const BOOTSTRAP_DDL = `
  CREATE TABLE IF NOT EXISTS sources (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    provider          TEXT NOT NULL DEFAULT 'r2',
    endpoint          TEXT NOT NULL,
    bucket            TEXT NOT NULL,
    access_key_id     TEXT NOT NULL,
    secret_access_key TEXT NOT NULL,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

function createClient(): PrismaClient {
  const dataDir = path.join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "app.db");

  const bootstrap = new Database(dbPath);
  bootstrap.pragma("journal_mode = WAL");
  bootstrap.exec(BOOTSTRAP_DDL);
  bootstrap.close();

  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  return new PrismaClient({ adapter });
}

// Survive Turbopack HMR re-evaluation in dev without stacking connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
globalForPrisma.prisma ??= createClient();
export const prisma = globalForPrisma.prisma;
