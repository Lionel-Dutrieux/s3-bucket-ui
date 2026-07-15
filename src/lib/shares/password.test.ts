import { describe, expect, it } from "vitest";
import { hashSharePassword, verifySharePassword } from "./password";

describe("share passwords", () => {
  it("verifies the password it hashed", () => {
    const stored = hashSharePassword("hunter2");
    expect(verifySharePassword("hunter2", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashSharePassword("hunter2");
    expect(verifySharePassword("hunter3", stored)).toBe(false);
  });

  it("salts: two hashes of the same password differ", () => {
    expect(hashSharePassword("same")).not.toBe(hashSharePassword("same"));
  });

  it("rejects malformed stored values instead of throwing", () => {
    expect(verifySharePassword("x", "not-a-hash")).toBe(false);
    expect(verifySharePassword("x", "")).toBe(false);
  });
});
