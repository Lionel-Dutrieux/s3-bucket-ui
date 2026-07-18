import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Data access for the SSO providers registered through the better-auth SSO
 * plugin (@better-auth/sso). The plugin owns the `sso_providers` table (rows
 * created via auth.api.registerSSOProvider); this module reads it for the admin
 * UI and manages the two pieces of state that live beside it in the Setting
 * table: the per-provider groups-claim name and the set of trusted issuer
 * origins better-auth needs before OIDC discovery will run.
 */

/** Shape surfaced to the admin UI — never carries the client secret. */
export interface SsoProviderRow {
  id: string;
  providerId: string;
  issuer: string;
  domain: string;
  clientId: string | null;
  scopes: string[];
  /** IdP claim (in userinfo or the id_token) holding the user's group names. */
  groupsClaim: string;
}

const GROUPS_CLAIM_PREFIX = "sso.groupsClaim.";
const TRUSTED_ORIGINS_KEY = "sso.trustedOrigins";

function groupsClaimKey(providerId: string): string {
  return `${GROUPS_CLAIM_PREFIX}${providerId}`;
}

/** Origin (scheme + host + port) of an issuer URL, or null if unparseable. */
export function ssoOriginOf(issuer: string): string | null {
  try {
    return new URL(issuer).origin;
  } catch {
    return null;
  }
}

function parseOidcConfig(json: string | null): {
  clientId: string | null;
  scopes: string[];
} {
  if (!json) return { clientId: null, scopes: [] };
  try {
    const config = JSON.parse(json) as {
      clientId?: unknown;
      scopes?: unknown;
    };
    return {
      clientId: typeof config.clientId === "string" ? config.clientId : null,
      scopes: Array.isArray(config.scopes)
        ? config.scopes.filter((s): s is string => typeof s === "string")
        : [],
    };
  } catch {
    return { clientId: null, scopes: [] };
  }
}

export async function listSsoProviders(): Promise<SsoProviderRow[]> {
  const [rows, claimRows] = await Promise.all([
    prisma.ssoProvider.findMany({ orderBy: { providerId: "asc" } }),
    prisma.setting.findMany({
      where: { key: { startsWith: GROUPS_CLAIM_PREFIX } },
      select: { key: true, value: true },
    }),
  ]);
  const claims = new Map(
    claimRows.map((row) => [
      row.key.slice(GROUPS_CLAIM_PREFIX.length),
      row.value,
    ]),
  );
  return rows.map((row) => {
    const { clientId, scopes } = parseOidcConfig(row.oidcConfig);
    return {
      id: row.id,
      providerId: row.providerId,
      issuer: row.issuer,
      domain: row.domain,
      clientId,
      scopes,
      groupsClaim: claims.get(row.providerId)?.trim() || "groups",
    };
  });
}

export async function countSsoProviders(): Promise<number> {
  return prisma.ssoProvider.count();
}

export async function hasSsoProviders(): Promise<boolean> {
  return (await countSsoProviders()) > 0;
}

// --- per-provider groups claim (Setting table) ---

/** The groups-claim name for a provider; defaults to "groups". */
export async function getProviderGroupsClaim(
  providerId: string,
): Promise<string> {
  const row = await prisma.setting.findUnique({
    where: { key: groupsClaimKey(providerId) },
    select: { value: true },
  });
  return row?.value?.trim() || "groups";
}

export async function setProviderGroupsClaim(
  providerId: string,
  claim: string,
): Promise<void> {
  const key = groupsClaimKey(providerId);
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: claim },
    update: { value: claim },
  });
}

// --- trusted issuer origins (Setting table) ---
//
// better-auth refuses OIDC discovery for an issuer whose origin isn't in
// `trustedOrigins` (discovery_untrusted_origin). Origins are persisted here and
// merged into the auth instance's trustedOrigins function (see auth.ts), so the
// origin must be added BEFORE registerSSOProvider runs its discovery.

export async function getSsoTrustedOrigins(): Promise<string[]> {
  const row = await prisma.setting.findUnique({
    where: { key: TRUSTED_ORIGINS_KEY },
    select: { value: true },
  });
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((o): o is string => typeof o === "string")
      : [];
  } catch {
    return [];
  }
}

async function saveTrustedOrigins(origins: string[]): Promise<void> {
  const value = JSON.stringify([...new Set(origins)]);
  await prisma.setting.upsert({
    where: { key: TRUSTED_ORIGINS_KEY },
    create: { key: TRUSTED_ORIGINS_KEY, value },
    update: { value },
  });
}

export async function addSsoTrustedOrigin(origin: string): Promise<void> {
  const current = await getSsoTrustedOrigins();
  if (current.includes(origin)) return;
  await saveTrustedOrigins([...current, origin]);
}

/** Drops an origin from the trusted set unless a provider still uses it. */
export async function pruneSsoTrustedOrigin(origin: string): Promise<void> {
  const stillUsed = (await listSsoProviders()).some(
    (provider) => ssoOriginOf(provider.issuer) === origin,
  );
  if (stillUsed) return;
  const current = await getSsoTrustedOrigins();
  if (!current.includes(origin)) return;
  await saveTrustedOrigins(current.filter((o) => o !== origin));
}

// --- provider lifecycle ---

/** Removes a provider row plus its groups-claim setting and orphan origin. */
export async function deleteSsoProvider(providerId: string): Promise<boolean> {
  const existing = await prisma.ssoProvider.findUnique({
    where: { providerId },
    select: { issuer: true },
  });
  if (!existing) return false;
  await prisma.ssoProvider.delete({ where: { providerId } });
  await prisma.setting.deleteMany({
    where: { key: groupsClaimKey(providerId) },
  });
  const origin = ssoOriginOf(existing.issuer);
  if (origin) await pruneSsoTrustedOrigin(origin);
  return true;
}

/**
 * Migrates accounts left by the old genericOAuth provider (provider_id =
 * "oidc") onto a newly registered SSO provider id. The account_id column holds
 * the IdP subject, which is stable per identity provider, so simply repointing
 * provider_id preserves every existing account (identity, groups, grants) with
 * no email-based linking — the safe path. Returns the number of accounts moved.
 * A no-op when the new id is literally "oidc".
 */
export async function relinkLegacyOidcAccounts(
  providerId: string,
): Promise<number> {
  if (providerId === "oidc") return 0;
  const result = await prisma.account.updateMany({
    where: { providerId: "oidc" },
    data: { providerId },
  });
  return result.count;
}
