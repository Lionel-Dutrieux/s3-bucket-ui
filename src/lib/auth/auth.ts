import "server-only";
import { sso } from "@better-auth/sso";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { extractGroups } from "@/lib/authz/oidc-groups";
import { syncOidcMemberships } from "@/lib/dal/groups";
import {
  getConfigVersion,
  isOidcOnly,
  isPublicSignUpEnabled,
} from "@/lib/dal/settings";
import { getProviderGroupsClaim, getSsoTrustedOrigins } from "@/lib/dal/sso";
import { env } from "@/lib/env";
import { sendPasswordResetEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { shouldRefresh } from "./auth-cache";

/** Label shown in users' authenticator apps for TOTP entries. */
const TWO_FACTOR_ISSUER = "Bucket UI";

/** Email/password endpoints refused when the instance runs SSO-only. */
const PASSWORD_ENDPOINTS = new Set([
  "/sign-in/email",
  "/sign-up/email",
  "/request-password-reset",
  "/reset-password",
  "/change-password",
]);

/**
 * SSO endpoints that mutate or expose provider configuration. The plugin leaves
 * these open to any authenticated user, which would let a regular user register
 * a rogue IdP — so they are gated to admins here (the admin UI drives them
 * through auth.api with the admin's session, which passes this check). Sign-in
 * (`/sign-in/sso`) and the IdP callbacks stay public by design.
 */
const SSO_ADMIN_PREFIXES = [
  "/sso/register",
  "/sso/update-provider",
  "/sso/providers",
  "/sso/get-provider",
  "/sso/request-domain-verification",
  "/sso/verify-domain",
];

/**
 * Failed sign-in → audit trail. Written with Prisma directly: the DAL's
 * recordOperation reads the session, which would import this module back.
 * Never throws — auditing must not break the auth pipeline.
 */
async function recordFailedSignIn(email: unknown): Promise<void> {
  try {
    await prisma.operation.create({
      data: {
        action: "sign-in-failed",
        sourceName: "Authentication",
        // Attacker-supplied input — bounded so failed-login floods can't
        // bloat the audit table (320 = max legal email length).
        target: typeof email === "string" ? email.slice(0, 320) : "unknown",
      },
    });
  } catch (error) {
    console.error("[auth] failed to audit sign-in failure:", error);
  }
}

function buildAuth() {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    // Dynamic: the app URL plus every registered SSO issuer's origin, which
    // better-auth requires trusted before it will run OIDC discovery.
    trustedOrigins: async () => [
      ...(env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : []),
      ...(await getSsoTrustedOrigins()),
    ],
    session: {
      // Disable better-auth's session-freshness gate (default freshAge: 24h).
      // The gate is keyed on session *createdAt*, so once a session crosses 24h
      // the freshness-guarded endpoints throw SESSION_NOT_FRESH — including the
      // read-only /list-sessions that /account renders, which then 500s the
      // whole page. It also blocks stale-session profile-name updates. Our
      // genuinely sensitive operations are gated by password re-entry instead
      // (change-password, 2FA enable/disable) or an authoritative re-read
      // (revoke-session), so freshness buys us nothing here.
      freshAge: 0,
    },
    // On by default in production. In-memory counters fit the single-container
    // deployment (they reset on restart — acceptable for brute-force slowdown).
    // The global default (100 req / 10 s) stays untouched so session lookups
    // never throttle; only credential endpoints get strict limits.
    rateLimit: {
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
        "/reset-password": { window: 300, max: 5 },
        "/change-password": { window: 60, max: 5 },
      },
    },
    emailAndPassword: {
      enabled: true,
      // Always wired: sendPasswordResetEmail throws if SMTP isn't configured,
      // and the "Forgot password?" link is hidden client-side without it.
      sendResetPassword: async ({
        user,
        url,
      }: {
        user: { email: string };
        url: string;
      }) => {
        await sendPasswordResetEmail(user.email, url);
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // SSO-only mode: the switch lives in Admin → Settings and can only be
        // enabled while an SSO provider is registered. Blocking here (not in
        // the UI) is the real gate; /admin/create-user stays available.
        if (PASSWORD_ENDPOINTS.has(ctx.path) && (await isOidcOnly())) {
          throw new APIError("FORBIDDEN", {
            message: "Password sign-in is disabled — use the SSO provider.",
          });
        }
        // Only admins may register/read/mutate SSO providers.
        if (SSO_ADMIN_PREFIXES.some((prefix) => ctx.path.startsWith(prefix))) {
          const session = await getSessionFromCtx(ctx);
          if (session?.user.role !== "admin") {
            throw new APIError("FORBIDDEN", {
              message: "Admin access required.",
            });
          }
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (
          ctx.path === "/sign-in/email" &&
          ctx.context.returned instanceof APIError
        ) {
          await recordFailedSignIn(
            (ctx.body as { email?: unknown } | undefined)?.email,
          );
        }
      }),
    },
    user: {
      additionalFields: {
        // `input: false` — never settable from the client (no mass assignment);
        // written only by the SSO provisionUser callback on sign-in.
        oidcGroups: {
          type: "string[]",
          required: false,
          input: false,
          defaultValue: [],
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // The very first account becomes admin (self-hosted bootstrap).
          // Accounts created by an admin (admin plugin endpoint) keep the role
          // the admin chose. Email/password self-registration is refused
          // unless an admin enabled it (Admin → Settings) — SSO sign-ins are
          // not governed by that switch, the IdP decides who exists. Every
          // non-admin creation is forced to "user" — defence in depth on top
          // of the admin plugin already marking `role` as non-inputable. The
          // race of two simultaneous first signups on an empty database is
          // accepted (single-instance bootstrap).
          before: async (user, ctx) => {
            if ((await prisma.user.count()) === 0) {
              return { data: { ...user, role: "admin" } };
            }
            if (ctx?.path === "/admin/create-user") return;
            if (
              ctx?.path === "/sign-up/email" &&
              !(await isPublicSignUpEnabled())
            ) {
              throw new APIError("FORBIDDEN", {
                message:
                  "Public sign-up is disabled — ask an admin to create your account.",
              });
            }
            return { data: { ...user, role: "user" } };
          },
        },
      },
    },
    plugins: [
      admin(),
      // twoFactor() must come before sso(): a plugin whose type widens the
      // plugins tuple after twoFactor can silently drop twoFactorEnabled from
      // the inferred session user type.
      twoFactor({ issuer: TWO_FACTOR_ISSUER }),
      sso({
        // Re-run on every sign-in so upstream group changes reach us each time.
        provisionUserOnEveryLogin: true,
        provisionUser: async ({ user, userInfo, token, provider }) => {
          // Resolve the group names from userinfo, falling back to the
          // id_token (Microsoft Entra only puts groups there), then reconcile
          // app-group memberships (à la Homarr). Never throws: syncOidc-
          // Memberships swallows its own errors, and a snapshot write that
          // fails must not break sign-in.
          const claim = await getProviderGroupsClaim(provider.providerId);
          const groups = extractGroups(userInfo, token?.idToken, claim);
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { oidcGroups: groups },
            });
          } catch (error) {
            console.error("[auth] failed to snapshot SSO groups:", error);
          }
          await syncOidcMemberships(user.id, groups);
        },
      }),
      nextCookies(), // must stay last so server actions can set cookies
    ],
  });
}

export type Auth = ReturnType<typeof buildAuth>;

const VERSION_TTL_MS = 5_000;

// On globalThis, like the Prisma client: survives Turbopack HMR.
const globalForAuth = globalThis as unknown as {
  authCache?: { instance: Auth; version: number; checkedAt: number };
};

/**
 * better-auth instance, rebuilt when the SMTP config changes (the Setting
 * `configVersion` key, checked at most once every 5 s). SSO providers and their
 * trusted origins are read from the database per request (dynamic
 * trustedOrigins + the plugin's own provider lookup), so registering or
 * removing a provider needs no rebuild.
 */
export async function getAuth(): Promise<Auth> {
  const cache = globalForAuth.authCache ?? null;
  const now = Date.now();
  if (cache && now - cache.checkedAt < VERSION_TTL_MS) return cache.instance;
  const dbVersion = await getConfigVersion();
  if (cache && !shouldRefresh(cache, dbVersion, now, VERSION_TTL_MS)) {
    cache.checkedAt = now;
    return cache.instance;
  }
  const instance = buildAuth();
  globalForAuth.authCache = { instance, version: dbVersion, checkedAt: now };
  return instance;
}
