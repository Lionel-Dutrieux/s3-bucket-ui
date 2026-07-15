import { describe, expect, it } from "vitest";
import { expiresAtFrom, SHARE_EXPIRY_OPTIONS } from "./expiry";

describe("expiresAtFrom", () => {
  const now = new Date("2026-07-15T12:00:00Z");

  it("maps 1d/7d/30d to the right instant", () => {
    expect(expiresAtFrom("1d", now)?.toISOString()).toBe(
      "2026-07-16T12:00:00.000Z",
    );
    expect(expiresAtFrom("7d", now)?.toISOString()).toBe(
      "2026-07-22T12:00:00.000Z",
    );
    expect(expiresAtFrom("30d", now)?.toISOString()).toBe(
      "2026-08-14T12:00:00.000Z",
    );
  });

  it("never → null (permanent link)", () => {
    expect(expiresAtFrom("never", now)).toBeNull();
  });

  it("every option value is accepted", () => {
    for (const option of SHARE_EXPIRY_OPTIONS) {
      expect(() => expiresAtFrom(option.value, now)).not.toThrow();
    }
  });
});
