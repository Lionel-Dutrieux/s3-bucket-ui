import { describe, expect, it } from "vitest";
import {
  decodeJwtPayload,
  extractGroups,
  normalizeGroupsClaim,
} from "./oidc-groups";

/** Builds an unsigned JWT with the given payload (header.payload.signature). */
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`;
}

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

describe("decodeJwtPayload", () => {
  it("decodes a well-formed JWT payload", () => {
    const jwt = makeJwt({ sub: "u1", groups: ["a", "b"] });
    expect(decodeJwtPayload(jwt)).toEqual({ sub: "u1", groups: ["a", "b"] });
  });

  it("returns null for non-strings and malformed tokens", () => {
    expect(decodeJwtPayload(undefined)).toBeNull();
    expect(decodeJwtPayload(123)).toBeNull();
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    expect(decodeJwtPayload("only.two")).toBeNull();
  });

  it("returns null when the payload isn't a JSON object", () => {
    const b64 = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");
    expect(decodeJwtPayload(`${b64({})}.${b64([1, 2])}.sig`)).toBeNull();
  });
});

describe("extractGroups", () => {
  it("reads groups from userInfo when present", () => {
    expect(extractGroups({ groups: ["admins"] }, null, "groups")).toEqual([
      "admins",
    ]);
  });

  it("falls back to the id_token when userInfo lacks the claim (Entra)", () => {
    const idToken = makeJwt({ groups: ["11111111-2222-3333"] });
    expect(extractGroups({ sub: "u1" }, idToken, "groups")).toEqual([
      "11111111-2222-3333",
    ]);
  });

  it("prefers userInfo over the id_token when both carry the claim", () => {
    const idToken = makeJwt({ groups: ["from-token"] });
    expect(
      extractGroups({ groups: ["from-userinfo"] }, idToken, "groups"),
    ).toEqual(["from-userinfo"]);
  });

  it("honours a custom claim name", () => {
    expect(extractGroups({ roles: ["a", "b"] }, null, "roles")).toEqual([
      "a",
      "b",
    ]);
  });

  it("returns [] when neither source has the claim", () => {
    expect(
      extractGroups({ sub: "u1" }, makeJwt({ sub: "u1" }), "groups"),
    ).toEqual([]);
    expect(extractGroups(null, null, "groups")).toEqual([]);
  });
});
