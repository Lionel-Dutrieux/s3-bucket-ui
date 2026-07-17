import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { decrypt, encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const SIGN_UP_KEY = "allowPublicSignUp";
const OIDC_ONLY_KEY = "oidcOnly";

async function getBoolSetting(key: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { key },
    select: { value: true },
  });
  return row?.value === "true";
}

async function setBoolSetting(key: string, enabled: boolean): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: String(enabled) },
    update: { value: String(enabled) },
  });
}

/**
 * Whether anyone may self-register with email/password. Defaults to false:
 * after the very first account (the admin), sign-up closes until an admin
 * re-opens it from Admin → Settings. OIDC sign-ins are not governed by this
 * — the identity provider decides who exists there.
 */
export async function isPublicSignUpEnabled(): Promise<boolean> {
  return getBoolSetting(SIGN_UP_KEY);
}

export async function setPublicSignUpEnabled(enabled: boolean): Promise<void> {
  await setBoolSetting(SIGN_UP_KEY, enabled);
}

/**
 * OIDC-only mode: every email/password endpoint (sign-in, sign-up, password
 * reset and change) is refused — the identity provider is the sole way in.
 * Only meaningful (and only enableable) when OIDC is configured.
 */
export async function isOidcOnly(): Promise<boolean> {
  return getBoolSetting(OIDC_ONLY_KEY);
}

export async function setOidcOnly(enabled: boolean): Promise<void> {
  await setBoolSetting(OIDC_ONLY_KEY, enabled);
}

const SHARING_KEY = "publicSharing";

/**
 * Whether signed-in users may mint public share links. Defaults to true —
 * an admin can switch it off from Admin → Settings to keep the instance
 * strictly private. Existing links stop resolving while it's off is NOT
 * implied: only creation is gated (revoke links individually).
 */
export async function isPublicSharingEnabled(): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { key: SHARING_KEY },
    select: { value: true },
  });
  return row?.value !== "false";
}

export async function setPublicSharingEnabled(enabled: boolean): Promise<void> {
  await setBoolSetting(SHARING_KEY, enabled);
}

// --- branding (white labelling) ---

const BRANDING_APP_NAME_KEY = "brandingAppName";
const BRANDING_LOGO_KEY = "brandingLogo";
const BRANDING_LOGO_VERSION_KEY = "brandingLogoVersion";
const BRANDING_COLOR_KEY = "brandingPrimaryColor";
const BRANDING_KEYS = [
  BRANDING_APP_NAME_KEY,
  BRANDING_LOGO_KEY,
  BRANDING_LOGO_VERSION_KEY,
  BRANDING_COLOR_KEY,
];

export interface BrandingSettings {
  appName: string | null;
  /** Custom logo as a data-URL (SVG/PNG/WebP), or null when unset. */
  logo: string | null;
  /** Bumped on every logo upload — cache-busts the logo route URL. */
  logoVersion: string | null;
  /** #RRGGBB, or null for the stock amber theme. */
  primaryColor: string | null;
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: BRANDING_KEYS } },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    appName: map.get(BRANDING_APP_NAME_KEY) ?? null,
    logo: map.get(BRANDING_LOGO_KEY) ?? null,
    logoVersion: map.get(BRANDING_LOGO_VERSION_KEY) ?? null,
    primaryColor: map.get(BRANDING_COLOR_KEY) ?? null,
  };
}

// Unawaited query builders — passed straight into prisma.$transaction([...])
// so a batch of writes commits or rolls back as one unit. (Standalone use
// still works: `await setStringSetting(...)` awaits the returned promise.)
function setStringSetting(
  key: string,
  value: string,
): Prisma.PrismaPromise<unknown> {
  return prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

function deleteSettings(keys: string[]): Prisma.PrismaPromise<unknown> {
  return prisma.setting.deleteMany({ where: { key: { in: keys } } });
}

export async function updateBrandingSettings(input: {
  appName: string;
  primaryColor: string | null;
  /** undefined → keep the current logo, null → remove it, string → replace it. */
  logo?: string | null;
}): Promise<void> {
  const operations: Prisma.PrismaPromise<unknown>[] = [
    setStringSetting(BRANDING_APP_NAME_KEY, input.appName),
  ];
  if (input.primaryColor) {
    operations.push(setStringSetting(BRANDING_COLOR_KEY, input.primaryColor));
  } else {
    operations.push(deleteSettings([BRANDING_COLOR_KEY]));
  }
  if (input.logo === null) {
    operations.push(
      deleteSettings([BRANDING_LOGO_KEY, BRANDING_LOGO_VERSION_KEY]),
    );
  } else if (typeof input.logo === "string") {
    operations.push(setStringSetting(BRANDING_LOGO_KEY, input.logo));
    operations.push(
      setStringSetting(BRANDING_LOGO_VERSION_KEY, String(Date.now())),
    );
  }
  await prisma.$transaction(operations);
}

export async function clearBrandingSettings(): Promise<void> {
  await deleteSettings(BRANDING_KEYS);
}

// --- runtime config (SMTP / OIDC overrides + version) ---

const CONFIG_VERSION_KEY = "configVersion";
const SECRET_KEYS = new Set(["smtp.password", "oidc.clientSecret"]);

export async function getConfigVersion(): Promise<number> {
  const row = await prisma.setting.findUnique({
    where: { key: CONFIG_VERSION_KEY },
    select: { value: true },
  });
  return row ? Number(row.value) : 0;
}

function bumpConfigVersion(current: number): Prisma.PrismaPromise<unknown> {
  return prisma.setting.upsert({
    where: { key: CONFIG_VERSION_KEY },
    create: { key: CONFIG_VERSION_KEY, value: String(current + 1) },
    update: { value: String(current + 1) },
  });
}

/** Overrides DB d'un groupe, clés sans préfixe, secrets déchiffrés. */
export async function getConfigOverrides(
  prefix: "smtp" | "oidc",
): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: `${prefix}.` } },
    select: { key: true, value: true },
  });
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.key === CONFIG_VERSION_KEY) continue;
    const field = row.key.slice(prefix.length + 1);
    result[field] = SECRET_KEYS.has(row.key) ? decrypt(row.value) : row.value;
  }
  return result;
}

/** null supprime la clé ; le tout + bump de version en une transaction. */
export async function setConfigOverrides(
  prefix: "smtp" | "oidc",
  values: Record<string, string | null>,
): Promise<void> {
  const version = await getConfigVersion();
  const operations: Prisma.PrismaPromise<unknown>[] = [];
  for (const [field, value] of Object.entries(values)) {
    const key = `${prefix}.${field}`;
    if (value === null) {
      operations.push(deleteSettings([key]));
    } else {
      const stored = SECRET_KEYS.has(key) ? encrypt(value) : value;
      operations.push(setStringSetting(key, stored));
    }
  }
  operations.push(bumpConfigVersion(version));
  await prisma.$transaction(operations);
}

export async function clearConfigOverrides(
  prefix: "smtp" | "oidc",
): Promise<void> {
  const version = await getConfigVersion();
  await prisma.$transaction([
    prisma.setting.deleteMany({ where: { key: { startsWith: `${prefix}.` } } }),
    bumpConfigVersion(version),
  ]);
}
