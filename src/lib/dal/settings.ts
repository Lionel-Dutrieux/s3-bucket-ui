import "server-only";
import { prisma } from "@/lib/prisma";

const SIGN_UP_KEY = "allowPublicSignUp";

/**
 * Whether anyone may self-register with email/password. Defaults to false:
 * after the very first account (the admin), sign-up closes until an admin
 * re-opens it from Admin → Settings. OIDC sign-ins are not governed by this
 * — the identity provider decides who exists there.
 */
export async function isPublicSignUpEnabled(): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { key: SIGN_UP_KEY },
    select: { value: true },
  });
  return row?.value === "true";
}

export async function setPublicSignUpEnabled(enabled: boolean): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SIGN_UP_KEY },
    create: { key: SIGN_UP_KEY, value: String(enabled) },
    update: { value: String(enabled) },
  });
}
