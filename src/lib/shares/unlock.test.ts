import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the request cookie store — unlock.ts only uses
// get/set on the awaited cookies() object.
const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
  }),
}));

import { grantUnlock, isUnlocked } from "@/lib/shares/unlock";

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);

describe("share unlock cookie", () => {
  beforeEach(() => {
    jar.clear();
    process.env.ENCRYPTION_KEY = KEY_A;
  });

  it("accepts the cookie it granted", async () => {
    await grantUnlock("token-1");
    expect(await isUnlocked("token-1")).toBe(true);
  });

  it("refuses when no cookie is present", async () => {
    expect(await isUnlocked("token-1")).toBe(false);
  });

  it("refuses a forged value, including one of a different length", async () => {
    await grantUnlock("token-1");
    const name = "share_unlock_token-1";
    const genuine = jar.get(name);
    if (!genuine) throw new Error("expected a granted cookie");

    // Same length, wrong bytes.
    jar.set(
      name,
      `${genuine.slice(0, -1)}${genuine.at(-1) === "A" ? "B" : "A"}`,
    );
    expect(await isUnlocked("token-1")).toBe(false);

    // Different length must fail cleanly, not throw in timingSafeEqual.
    jar.set(name, genuine.slice(0, 10));
    expect(await isUnlocked("token-1")).toBe(false);

    jar.set(name, "");
    expect(await isUnlocked("token-1")).toBe(false);
  });

  it("does not unlock another share with a genuine cookie", async () => {
    await grantUnlock("token-1");
    // The other share has no cookie at all…
    expect(await isUnlocked("token-2")).toBe(false);
    // …and pasting token-1's proof under token-2's name must not help.
    const stolen = jar.get("share_unlock_token-1");
    if (!stolen) throw new Error("expected a granted cookie");
    jar.set("share_unlock_token-2", stolen);
    expect(await isUnlocked("token-2")).toBe(false);
  });

  it("invalidates existing cookies when the server key changes", async () => {
    await grantUnlock("token-1");
    process.env.ENCRYPTION_KEY = KEY_B;
    expect(await isUnlocked("token-1")).toBe(false);
  });

  it("throws on a malformed ENCRYPTION_KEY instead of degrading", async () => {
    process.env.ENCRYPTION_KEY = "not-hex";
    await expect(grantUnlock("token-1")).rejects.toThrow(/ENCRYPTION_KEY/);
  });
});
