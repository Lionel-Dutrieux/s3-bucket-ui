import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Used by the CLI (db push); the runtime client uses lib/prisma.ts.
    url: "file:./data/app.db",
  },
});
