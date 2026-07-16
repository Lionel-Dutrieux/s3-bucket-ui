import "server-only";
import type { Prisma } from "@/generated/prisma/client";
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
