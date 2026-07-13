import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// A prisma.config.ts disables Prisma's automatic .env loading, so the CLI
// (migrate/generate) would not see DATABASE_URL. Load it ourselves with the
// Node 22 built-in — no `dotenv` dependency needed.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Connection string the Prisma CLI uses for migrations (the runtime client
  // connects through the driver adapter in lib/prisma.ts). Read directly,
  // rather than via env(), so `prisma generate` — which never connects — keeps
  // working when DATABASE_URL is unset (CI checks, Docker build). Commands that
  // do connect (migrate) fail clearly on an empty URL.
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
