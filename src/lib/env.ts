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
    // Optional generic OIDC provider (e.g. Pocket ID). All three of
    // OIDC_DISCOVERY_URL / OIDC_CLIENT_ID / OIDC_CLIENT_SECRET must be set
    // together — enforced at boot (instrumentation.ts → assertOidcEnv).
    OIDC_DISCOVERY_URL: z.url().optional(),
    OIDC_CLIENT_ID: z.string().optional(),
    OIDC_CLIENT_SECRET: z.string().optional(),
    /** Label shown on the sign-in button for the OIDC provider. */
    OIDC_PROVIDER_LABEL: z.string().default("SSO"),
    OIDC_SCOPES: z.string().default("openid profile email groups"),
    /** Token/userinfo claim holding the user's group names. */
    OIDC_GROUPS_CLAIM: z.string().default("groups"),
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
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    OIDC_DISCOVERY_URL: process.env.OIDC_DISCOVERY_URL,
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET,
    OIDC_PROVIDER_LABEL: process.env.OIDC_PROVIDER_LABEL,
    OIDC_SCOPES: process.env.OIDC_SCOPES,
    OIDC_GROUPS_CLAIM: process.env.OIDC_GROUPS_CLAIM,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM: process.env.SMTP_FROM,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

/** The OIDC provider is enabled only when its three variables are all set. */
export function oidcEnabled(): boolean {
  return Boolean(
    env.OIDC_DISCOVERY_URL && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET,
  );
}

/** Password-reset emails are available only when an SMTP relay is set. */
export function smtpEnabled(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

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

/** Boot-time check: a partially configured OIDC trio is a deployment mistake. */
export function assertOidcEnv(): void {
  const set = [
    env.OIDC_DISCOVERY_URL,
    env.OIDC_CLIENT_ID,
    env.OIDC_CLIENT_SECRET,
  ].filter((value) => value !== undefined).length;
  if (set !== 0 && set !== 3) {
    throw new Error(
      "OIDC is partially configured — set all of OIDC_DISCOVERY_URL, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET, or none.",
    );
  }
}
