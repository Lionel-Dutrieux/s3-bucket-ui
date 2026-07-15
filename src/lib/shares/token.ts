import { randomBytes } from "node:crypto";

/** 128 bits of entropy, url-safe — the token IS the capability. */
export function generateShareToken(): string {
  return randomBytes(16).toString("base64url");
}
