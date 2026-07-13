import { beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/lib/crypto";

const VALID_KEY = "ab".repeat(32); // 64 hex chars

describe("crypto", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
  });

  it("roundtrips arbitrary text", () => {
    const plain = "r2-secret-key-🌊 with unicode";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects a tampered payload (GCM auth tag)", () => {
    const payload = Buffer.from(encrypt("secret"), "base64");
    payload[payload.length - 1] ^= 0xff;
    expect(() => decrypt(payload.toString("base64"))).toThrow();
  });

  it("rejects a payload encrypted with another key", () => {
    const ciphertext = encrypt("secret");
    process.env.ENCRYPTION_KEY = "cd".repeat(32);
    expect(() => decrypt(ciphertext)).toThrow();
  });

  it("throws a clear error when ENCRYPTION_KEY is malformed", () => {
    process.env.ENCRYPTION_KEY = "too-short";
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
  });
});
