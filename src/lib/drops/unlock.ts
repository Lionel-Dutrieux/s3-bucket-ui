import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Proof-of-password cookie for a drop link: value = HMAC(token) under
// ENCRYPTION_KEY, so it can't be forged without the server key and is worthless
// for any other link. Mirrors lib/shares/unlock.ts but under a distinct
// namespace ("drop-unlock:" / "drop_unlock_") so a share cookie can never
// satisfy a drop link or vice versa.

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "ENCRYPTION_KEY must be 64 hex characters. Generate one with: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

function unlockValue(token: string): string {
  return createHmac("sha256", getKey())
    .update(`drop-unlock:${token}`)
    .digest("base64url");
}

function cookieName(token: string): string {
  return `drop_unlock_${token}`;
}

/** Re-prompt after an hour — long enough to finish a batch of uploads. */
const UNLOCK_MAX_AGE_SECONDS = 60 * 60;

export async function grantDropUnlock(token: string): Promise<void> {
  (await cookies()).set(cookieName(token), unlockValue(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Must cover both /d/<token> (page) and /api/d/<token>/upload.
    path: "/",
    maxAge: UNLOCK_MAX_AGE_SECONDS,
  });
}

export async function isDropUnlocked(token: string): Promise<boolean> {
  const value = (await cookies()).get(cookieName(token))?.value;
  if (!value) return false;
  const actual = Buffer.from(value, "base64url");
  const expected = Buffer.from(unlockValue(token), "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
