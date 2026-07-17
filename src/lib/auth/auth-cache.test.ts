import { describe, expect, it } from "vitest";
import { shouldRefresh } from "./auth-cache";

describe("shouldRefresh", () => {
  it("no cache yet → refresh", () => {
    expect(shouldRefresh(null, 0, 1_000, 5_000)).toBe(true);
  });
  it("TTL not expired → keep instance without DB read", () => {
    expect(
      shouldRefresh({ version: 1, checkedAt: 1_000 }, null, 3_000, 5_000),
    ).toBe(false);
  });
  it("TTL expired, same version → keep", () => {
    expect(
      shouldRefresh({ version: 1, checkedAt: 1_000 }, 1, 7_000, 5_000),
    ).toBe(false);
  });
  it("TTL expired, version bumped → rebuild", () => {
    expect(
      shouldRefresh({ version: 1, checkedAt: 1_000 }, 2, 7_000, 5_000),
    ).toBe(true);
  });
});
