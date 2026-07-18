"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ssoProviderSchema } from "@/features/admin/lib/schema";
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
import { ActionError, adminActionClient } from "@/lib/safe-action";

// Every action runs through adminActionClient (src/lib/safe-action.ts), which
// re-checks the admin role server-side — the /admin layout guard protects
// pages only, never these POST endpoints — and revalidates the root layout on
// success.

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
export const registerSsoProvider = adminActionClient
  .metadata({
    actionName: "admin.registerSsoProvider",
    failureKey: "admin.errors.settingUpdateFailed",
  })
  .inputSchema(ssoProviderSchema)
  .action(async ({ parsedInput }) => {
    const t = await getTranslations("admin.errors");
    const {
      providerId,
      issuer,
      clientId,
      clientSecret,
      domain,
      scopes,
      groupsClaim,
    } = parsedInput;

    const origin = ssoOriginOf(issuer);
    if (!origin) throw new ActionError(t("ssoInvalidIssuer"));

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
      throw new ActionError(message);
    }

    await setProviderGroupsClaim(providerId, groupsClaim);
    if (isFirstProvider) {
      await relinkLegacyOidcAccounts(providerId);
    }
  });

/** Removes a registered SSO provider (config only — accounts are untouched). */
export const removeSsoProvider = adminActionClient
  .metadata({
    actionName: "admin.removeSsoProvider",
    failureKey: "admin.errors.settingUpdateFailed",
  })
  .inputSchema(z.object({ providerId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    const t = await getTranslations("admin.errors");
    const removed = await deleteSsoProvider(parsedInput.providerId);
    if (!removed) throw new ActionError(t("ssoProviderNotFound"));
  });
