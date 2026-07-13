import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Bootstrap DDL so a fresh database (first boot, empty Docker volume) works
// without a deploy step (production runs `node server.js`, never `db:push`).
// MUST stay in sync with prisma/schema.prisma. New tables: add a
// CREATE TABLE IF NOT EXISTS below. New columns on an existing table: add
// them here AND to `COLUMN_MIGRATIONS`, so databases created before the
// column get it too.
const BOOTSTRAP_DDL = `
  CREATE TABLE IF NOT EXISTS sources (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    provider          TEXT NOT NULL DEFAULT 'r2',
    endpoint          TEXT NOT NULL,
    bucket            TEXT NOT NULL,
    access_key_id     TEXT NOT NULL,
    secret_access_key TEXT NOT NULL,
    allow_upload      INTEGER NOT NULL DEFAULT 0,
    allow_delete      INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS operations (
    id          TEXT PRIMARY KEY,
    action      TEXT NOT NULL,
    source_id   TEXT,
    source_name TEXT NOT NULL,
    target      TEXT NOT NULL,
    detail      TEXT,
    actor       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS operations_created_at
    ON operations (created_at);
`;

// Columns added after a table first shipped. ALTER TABLE ADD COLUMN isn't
// idempotent in SQLite (it errors if the column exists), so each is applied
// only when PRAGMA table_info shows it missing.
const COLUMN_MIGRATIONS: Record<string, Record<string, string>> = {
  sources: {
    allow_upload: "INTEGER NOT NULL DEFAULT 0",
    allow_delete: "INTEGER NOT NULL DEFAULT 0",
  },
};

function applyColumnMigrations(db: Database.Database): void {
  for (const [table, columns] of Object.entries(COLUMN_MIGRATIONS)) {
    const existing = new Set(
      (db.pragma(`table_info(${table})`) as { name: string }[]).map(
        (column) => column.name,
      ),
    );
    for (const [name, ddl] of Object.entries(columns)) {
      if (!existing.has(name)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
      }
    }
  }
}

function createClient(): PrismaClient {
  const dataDir = path.join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "app.db");

  const bootstrap = new Database(dbPath);
  bootstrap.pragma("journal_mode = WAL");
  bootstrap.exec(BOOTSTRAP_DDL);
  applyColumnMigrations(bootstrap);
  bootstrap.close();

  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  return new PrismaClient({ adapter });
}

// Survive Turbopack HMR re-evaluation in dev without stacking connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
globalForPrisma.prisma ??= createClient();
export const prisma = globalForPrisma.prisma;
