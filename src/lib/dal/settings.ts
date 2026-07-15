import "server-only";
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
