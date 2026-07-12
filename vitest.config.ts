import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // server-only throws outside a React Server environment — stub it out
      // so pure server modules (crypto, services) stay unit-testable.
      {
        find: /^server-only$/,
        replacement: path.resolve(rootDir, "test/server-only-stub.ts"),
      },
      { find: /^@\//, replacement: `${rootDir}/` },
    ],
  },
  test: {
    environment: "node",
  },
});
