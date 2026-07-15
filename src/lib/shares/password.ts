import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Stored as `base64url(salt).base64url(scrypt(password, salt))` — no external
// dependency, and scrypt's work factor is enough for a share-link password.

export function hashSharePassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, 32);
  return `${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

export function verifySharePassword(password: string, stored: string): boolean {
  const [saltPart, hashPart] = stored.split(".");
  if (!saltPart || !hashPart) return false;
  try {
    const salt = Buffer.from(saltPart, "base64url");
    const expected = Buffer.from(hashPart, "base64url");
    if (expected.length === 0) return false;
    const actual = scryptSync(
      password.normalize("NFKC"),
      salt,
      expected.length,
    );
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
