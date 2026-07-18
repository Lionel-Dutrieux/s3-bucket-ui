"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import {
  type SsoProviderValues,
  ssoProviderSchema,
} from "@/features/admin/lib/schema";
import { withAdmin } from "@/features/admin/server/guard";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { getAuth } from "@/lib/auth/auth";
import {
  addSsoTrustedOrigin,
  countSsoProviders,
  deleteSsoProvider,
  pruneSsoTrustedOrigin,
  relinkLegacyOidcAccounts,
  setProviderGroupsClaim,
  ssoOriginOf,
} from "@/lib/dal/sso";

/**
 * Registers an SSO identity provider through the better-auth SSO plugin.
 *
 * The issuer's origin is trusted first (better-auth refuses OIDC discovery for
 * an untrusted origin), then the provider is registered via `auth.api` with the
 * admin's own session — the auth `before` hook re-checks the admin role there.
 * The per-provider groups-claim name is stored beside the row, and on the very
 * first registration any accounts left by the legacy genericOAuth provider
 * ("oidc") are repointed at the new provider id so nobody loses their account.
 */
export async function registerSsoProvider(
  input: SsoProviderValues,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "register sso provider",
      failureMessage: t("settingUpdateFailed"),
    },
    async () => {
      const parsed = ssoProviderSchema.safeParse(input);
      if (!parsed.success) {
        return actionError(
          parsed.error.issues[0]?.message ?? t("invalidInput"),
        );
      }
      const {
        providerId,
        issuer,
        clientId,
        clientSecret,
        domain,
        scopes,
        groupsClaim,
      } = parsed.data;

      const origin = ssoOriginOf(issuer);
      if (!origin) return actionError(t("ssoInvalidIssuer"));

      // Trust the origin before discovery runs, and remember whether this is
      // the first provider (drives the legacy-account relink).
      const isFirstProvider = (await countSsoProviders()) === 0;
      await addSsoTrustedOrigin(origin);

      const auth = await getAuth();
      try {
        await auth.api.registerSSOProvider({
          headers: await headers(),
          body: {
            providerId,
            issuer,
            domain,
            overrideUserInfo: true,
            oidcConfig: {
              clientId,
              clientSecret,
              scopes: scopes.split(" ").filter(Boolean),
              pkce: true,
            },
          },
        });
      } catch (error) {
        // Registration failed (discovery unreachable, duplicate id, …) — undo
        // the origin we optimistically trusted, then surface the reason.
        await pruneSsoTrustedOrigin(origin);
        const message =
          error instanceof Error && error.message
            ? error.message
            : t("ssoRegisterFailed");
        return actionError(message);
      }

      await setProviderGroupsClaim(providerId, groupsClaim);
      if (isFirstProvider) {
        await relinkLegacyOidcAccounts(providerId);
      }
      return actionOk();
    },
  );
}

/** Removes a registered SSO provider (config only — accounts are untouched). */
export async function removeSsoProvider(
  providerId: string,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    { action: "remove sso provider", failureMessage: t("settingUpdateFailed") },
    async () => {
      const removed = await deleteSsoProvider(providerId);
      if (!removed) return actionError(t("ssoProviderNotFound"));
      return actionOk();
    },
  );
}
