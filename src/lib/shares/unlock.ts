import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";

// Proof-of-password cookie: value = HMAC(token) under ENCRYPTION_KEY, so it
// can't be forged without the server key and is worthless for any other
// share. Reads process.env directly, mirroring lib/crypto.ts.

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
    .update(`share-unlock:${token}`)
    .digest("base64url");
}

function cookieName(token: string): string {
  return `share_unlock_${token}`;
}

/** Re-prompt after an hour — long enough to finish a big download. */
const UNLOCK_MAX_AGE_SECONDS = 60 * 60;

export async function grantUnlock(token: string): Promise<void> {
  (await cookies()).set(cookieName(token), unlockValue(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Must cover both /s/<token> (page) and /api/s/<token>/download.
    path: "/",
    maxAge: UNLOCK_MAX_AGE_SECONDS,
  });
}

export async function isUnlocked(token: string): Promise<boolean> {
  const value = (await cookies()).get(cookieName(token))?.value;
  return value === unlockValue(token);
}
