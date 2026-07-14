import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, genericOAuth } from "better-auth/plugins";
import { normalizeGroupsClaim } from "@/lib/authz/oidc-groups";
import { syncOidcMemberships } from "@/lib/dal/groups";
import { isPublicSignUpEnabled } from "@/lib/dal/settings";
import { env } from "@/lib/env";
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

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : [],
  emailAndPassword: { enabled: true },
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
