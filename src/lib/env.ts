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
    DATABASE_URL: z.url(),
    ENCRYPTION_KEY: z
      .string()
      .regex(
        /^[0-9a-fA-F]{64}$/,
        "must be 64 hex characters — generate one with: openssl rand -hex 32",
      ),
    BETTER_AUTH_SECRET: z
      .string()
      .min(
        32,
        "must be at least 32 characters — generate one with: openssl rand -base64 32",
      ),
    /** Public URL of the app (scheme included) — cookie security derives from it. */
    BETTER_AUTH_URL: z.url(),
    // Optional SMTP relay — enables password-reset emails. SMTP_HOST and
    // SMTP_FROM go together (enforced at boot, assertSmtpEnv).
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    /** Sender, e.g. "Bucket UI <bucket-ui@example.com>". */
    SMTP_FROM: z.string().optional(),
    /** Comma-separated directory allowlist for "Local folder" sources.
     *  Unset = the local provider is hidden and rejected. */
    LOCAL_FS_ROOTS: z.string().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM: process.env.SMTP_FROM,
    LOCAL_FS_ROOTS: process.env.LOCAL_FS_ROOTS,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

/** Boot-time check: SMTP_HOST and SMTP_FROM come as a pair. */
export function assertSmtpEnv(): void {
  const set = [env.SMTP_HOST, env.SMTP_FROM].filter(
    (value) => value !== undefined,
  ).length;
  if (set === 1) {
    throw new Error(
      "SMTP is partially configured — set both SMTP_HOST and SMTP_FROM, or neither.",
    );
  }
}
