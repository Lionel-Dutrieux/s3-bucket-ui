import { describe, expect, it } from "vitest";
import {
  allowedExpiryOptions,
  capExpiresAt,
  normalizeMaxExpiryDays,
} from "./policy";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date("2026-07-18T12:00:00Z");

describe("normalizeMaxExpiryDays", () => {
  it("keeps a positive whole number", () => {
    expect(normalizeMaxExpiryDays(7)).toBe(7);
  });

  it("floors a fractional day count", () => {
    expect(normalizeMaxExpiryDays(7.9)).toBe(7);
  });

  it("treats null, zero, negative and NaN as no cap", () => {
    expect(normalizeMaxExpiryDays(null)).toBeNull();
    expect(normalizeMaxExpiryDays(0)).toBeNull();
    expect(normalizeMaxExpiryDays(-5)).toBeNull();
    expect(normalizeMaxExpiryDays(Number.NaN)).toBeNull();
    expect(normalizeMaxExpiryDays(0.5)).toBeNull();
  });
});

describe("capExpiresAt", () => {
  it("leaves the instant untouched when there is no cap", () => {
    const asked = new Date(now.getTime() + 30 * DAY_MS);
    expect(capExpiresAt(asked, null, now)).toEqual(asked);
    expect(capExpiresAt(null, null, now)).toBeNull();
  });

  it("pulls an over-long expiry back to the ceiling", () => {
    const asked = new Date(now.getTime() + 30 * DAY_MS);
    expect(capExpiresAt(asked, 7, now)?.toISOString()).toBe(
      new Date(now.getTime() + 7 * DAY_MS).toISOString(),
    );
  });

  it("turns 'never' (null) into the ceiling when a cap is set", () => {
    expect(capExpiresAt(null, 7, now)?.toISOString()).toBe(
      new Date(now.getTime() + 7 * DAY_MS).toISOString(),
    );
  });

  it("keeps an expiry already within the cap", () => {
    const asked = new Date(now.getTime() + 3 * DAY_MS);
    expect(capExpiresAt(asked, 7, now)).toEqual(asked);
  });
});

describe("allowedExpiryOptions", () => {
  it("offers every option (incl. never) when there is no cap", () => {
    expect(allowedExpiryOptions(null).map((o) => o.value)).toEqual([
      "1d",
      "7d",
      "30d",
      "never",
    ]);
  });

  it("drops 'never' and options longer than the cap", () => {
    expect(allowedExpiryOptions(7).map((o) => o.value)).toEqual(["1d", "7d"]);
    expect(allowedExpiryOptions(10).map((o) => o.value)).toEqual(["1d", "7d"]);
    expect(allowedExpiryOptions(30).map((o) => o.value)).toEqual([
      "1d",
      "7d",
      "30d",
    ]);
  });

  it("always keeps at least the 1-day option under any cap ≥ 1", () => {
    expect(allowedExpiryOptions(1).map((o) => o.value)).toEqual(["1d"]);
  });
});
