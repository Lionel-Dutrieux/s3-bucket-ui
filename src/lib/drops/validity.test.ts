import { describe, expect, it } from "vitest";
import { type DropValidity, isDropLive, isFileLimitReached } from "./validity";

const NOW = new Date("2026-07-18T12:00:00Z");

function drop(overrides: Partial<DropValidity> = {}): DropValidity {
  return {
    revokedAt: null,
    expiresAt: null,
    uploadsCount: 0,
    maxFiles: null,
    ...overrides,
  };
}

describe("isFileLimitReached", () => {
  it("is false when uncapped", () => {
    expect(isFileLimitReached(100, null)).toBe(false);
  });

  it("is true once the count meets or exceeds the cap", () => {
    expect(isFileLimitReached(2, 3)).toBe(false);
    expect(isFileLimitReached(3, 3)).toBe(true);
    expect(isFileLimitReached(4, 3)).toBe(true);
  });
});

describe("isDropLive", () => {
  it("is live by default", () => {
    expect(isDropLive(drop(), NOW)).toBe(true);
  });

  it("is dead once revoked", () => {
    expect(isDropLive(drop({ revokedAt: NOW }), NOW)).toBe(false);
  });

  it("is dead at or past expiry", () => {
    expect(
      isDropLive(drop({ expiresAt: new Date(NOW.getTime() - 1) }), NOW),
    ).toBe(false);
    expect(isDropLive(drop({ expiresAt: NOW }), NOW)).toBe(false);
  });

  it("is still live before expiry", () => {
    expect(
      isDropLive(drop({ expiresAt: new Date(NOW.getTime() + 1000) }), NOW),
    ).toBe(true);
  });

  it("stays live even when the file cap is reached (upload gate handles it)", () => {
    expect(isDropLive(drop({ uploadsCount: 5, maxFiles: 5 }), NOW)).toBe(true);
  });
});
