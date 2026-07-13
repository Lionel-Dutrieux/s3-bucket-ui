import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated, typed access to the server environment. Importing this module
 * validates the variables, so a missing or malformed one fails fast (at boot,
 * via instrumentation.ts) instead of erroring on the first request.
 *
 * Validation is skipped when `SKIP_ENV_VALIDATION` is set — used for the
 * production build (`next build`), which never touches the database and runs
 * without secrets. The running server still validates (instrumentation.ts).
 */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    ENCRYPTION_KEY: z
      .string()
      .regex(
        /^[0-9a-fA-F]{64}$/,
        "must be 64 hex characters — generate one with: openssl rand -hex 32",
      ),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
