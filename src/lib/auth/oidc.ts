import "server-only";
import type { genericOAuth } from "better-auth/plugins";
import { normalizeGroupsClaim } from "@/lib/authz/oidc-groups";
import type { OidcConfig } from "@/lib/config";

type OidcProviderConfig = Parameters<typeof genericOAuth>[0]["config"][number];

/** Fixed provider id — the sign-in button and callback URL both use it. */
export const OIDC_PROVIDER_ID = "oidc";

/**
 * Generic OIDC provider built from the resolved config (DB overrides > env).
 * `overrideUserInfo` re-maps the profile on every sign-in, so the `groups`
 * claim snapshot (user.oidcGroups) stays fresh — the membership sync happens
 * in the user database hooks (see auth.ts).
 *
 * If an IdP only puts `groups` in the id_token (not the userinfo endpoint),
 * add a custom `getUserInfo(tokens)` here that decodes `tokens.idToken`.
 */
export function buildOidcProvider(config: OidcConfig): OidcProviderConfig {
  return {
    providerId: OIDC_PROVIDER_ID,
    discoveryUrl: config.discoveryUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    scopes: config.scopes.split(" ").filter(Boolean),
    overrideUserInfo: true,
    // The generic-oauth types only know the base user fields; the runtime
    // does merge mapped `user.additionalFields` (like oidcGroups) — hence the
    // cast through the declared return type.
    mapProfileToUser: (profile) =>
      ({
        oidcGroups: normalizeGroupsClaim(profile[config.groupsClaim]),
      }) as unknown as ReturnType<
        NonNullable<OidcProviderConfig["mapProfileToUser"]>
      >,
  };
}
