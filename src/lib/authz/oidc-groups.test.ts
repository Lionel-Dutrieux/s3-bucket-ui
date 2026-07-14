import { describe, expect, it } from "vitest";
import { normalizeGroupsClaim } from "./oidc-groups";

describe("normalizeGroupsClaim", () => {
  it("keeps string entries of an array", () => {
    expect(normalizeGroupsClaim(["admins", "devs"])).toEqual([
      "admins",
      "devs",
    ]);
  });

  it("drops non-string entries", () => {
    expect(normalizeGroupsClaim(["admins", 42, null, { a: 1 }])).toEqual([
      "admins",
    ]);
  });

  it("splits a single string on commas and whitespace", () => {
    expect(normalizeGroupsClaim("admins, devs ops")).toEqual([
      "admins",
      "devs",
      "ops",
    ]);
  });

  it("deduplicates and drops empties", () => {
    expect(normalizeGroupsClaim(["a", "a", " ", ""])).toEqual(["a"]);
  });

  it("returns [] for anything else", () => {
    expect(normalizeGroupsClaim(undefined)).toEqual([]);
    expect(normalizeGroupsClaim(null)).toEqual([]);
    expect(normalizeGroupsClaim(123)).toEqual([]);
    expect(normalizeGroupsClaim({ groups: ["a"] })).toEqual([]);
  });
});
