import "server-only";
import type { genericOAuth } from "better-auth/plugins";
import { normalizeGroupsClaim } from "@/lib/authz/oidc-groups";
import { env, oidcEnabled } from "@/lib/env";

type OidcProviderConfig = Parameters<typeof genericOAuth>[0]["config"][number];

/** Fixed provider id — the sign-in button and callback URL both use it. */
export const OIDC_PROVIDER_ID = "oidc";

/**
 * Generic OIDC provider built from the environment (OIDC_* variables), or
 * null when not configured. `overrideUserInfo` re-maps the profile on every
 * sign-in, so the `groups` claim snapshot (user.oidcGroups) stays fresh — the
 * membership sync happens in the user database hooks (see auth.ts).
 *
 * If an IdP only puts `groups` in the id_token (not the userinfo endpoint),
 * add a custom `getUserInfo(tokens)` here that decodes `tokens.idToken`.
 */
export function buildOidcProvider(): OidcProviderConfig | null {
  const { OIDC_DISCOVERY_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET } = env;
  if (
    !oidcEnabled() ||
    !OIDC_DISCOVERY_URL ||
    !OIDC_CLIENT_ID ||
    !OIDC_CLIENT_SECRET
  ) {
    return null;
  }
  return {
    providerId: OIDC_PROVIDER_ID,
    discoveryUrl: OIDC_DISCOVERY_URL,
    clientId: OIDC_CLIENT_ID,
    clientSecret: OIDC_CLIENT_SECRET,
    scopes: env.OIDC_SCOPES.split(" ").filter(Boolean),
    overrideUserInfo: true,
    // The generic-oauth types only know the base user fields; the runtime
    // does merge mapped `user.additionalFields` (like oidcGroups) — hence the
    // cast through the declared return type.
    mapProfileToUser: (profile) =>
      ({
        oidcGroups: normalizeGroupsClaim(profile[env.OIDC_GROUPS_CLAIM]),
      }) as unknown as ReturnType<
        NonNullable<OidcProviderConfig["mapProfileToUser"]>
      >,
  };
}
