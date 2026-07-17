import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, genericOAuth } from "better-auth/plugins";
import { normalizeGroupsClaim } from "@/lib/authz/oidc-groups";
import { syncOidcMemberships } from "@/lib/dal/groups";
import { isOidcOnly, isPublicSignUpEnabled } from "@/lib/dal/settings";
import { env, smtpEnabled } from "@/lib/env";
import { sendPasswordResetEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { buildOidcProvider } from "./oidc";

const oidcProvider = buildOidcProvider();

/** Runs the Homarr-style group sync after an OIDC sign-in touched the user. */
async function syncGroupsFromOidcCallback(
  user: { id: string } & Record<string, unknown>,
  ctxPath: string | undefined,
): Promise<void> {
  if (!ctxPath?.includes("/oauth2/callback")) return;
  await syncOidcMemberships(user.id, normalizeGroupsClaim(user.oidcGroups));
}

/** Email/password endpoints refused when the instance runs OIDC-only. */
const PASSWORD_ENDPOINTS = new Set([
  "/sign-in/email",
  "/sign-up/email",
  "/request-password-reset",
  "/reset-password",
  "/change-password",
]);

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

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : [],
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
    // Reset emails only when an SMTP relay is configured — without it the
    // "Forgot password?" flow is hidden client-side and this stays unset.
    ...(smtpEnabled()
      ? {
          sendResetPassword: async ({
            user,
            url,
          }: {
            user: { email: string };
            url: string;
          }) => {
            await sendPasswordResetEmail(user.email, url);
          },
        }
      : {}),
  },
  hooks: {
    // OIDC-only mode: the switch lives in Admin → Settings and can only be
    // enabled while OIDC is configured. Blocking here (not in the UI) is the
    // real gate; /admin/create-user stays available to admins.
    before: createAuthMiddleware(async (ctx) => {
      if (PASSWORD_ENDPOINTS.has(ctx.path) && (await isOidcOnly())) {
        throw new APIError("FORBIDDEN", {
          message: "Password sign-in is disabled — use the SSO provider.",
        });
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
      // written only by mapProfileToUser on OIDC sign-in (see oidc.ts).
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
        // unless an admin enabled it (Admin → Settings) — OIDC sign-ins are
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
        after: async (user, ctx) => {
          await syncGroupsFromOidcCallback(user, ctx?.path);
        },
      },
      update: {
        after: async (user, ctx) => {
          await syncGroupsFromOidcCallback(user, ctx?.path);
        },
      },
    },
  },
  plugins: [
    admin(),
    ...(oidcProvider ? [genericOAuth({ config: [oidcProvider] })] : []),
    nextCookies(), // must stay last so server actions can set cookies
  ],
});
