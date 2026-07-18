import { describe, expect, it } from "vitest";
import { SSO_PRESETS, ssoPresetById } from "./sso-presets";

describe("SSO_PRESETS", () => {
  it("exposes the four documented IdP presets", () => {
    expect(SSO_PRESETS.map((preset) => preset.id)).toEqual([
      "pocket-id",
      "keycloak",
      "entra",
      "generic",
    ]);
  });

  it("requests the groups scope where the IdP exposes it in userinfo", () => {
    expect(ssoPresetById("pocket-id")?.scopes).toContain("groups");
    expect(ssoPresetById("keycloak")?.scopes).toContain("groups");
  });

  it("does not request a groups scope for Entra (groups ride the id_token)", () => {
    expect(ssoPresetById("entra")?.scopes).not.toContain("groups");
    expect(ssoPresetById("entra")?.groupsClaim).toBe("groups");
  });

  it("gives every preset a groups claim and only some a help note", () => {
    for (const preset of SSO_PRESETS) {
      expect(preset.groupsClaim.length).toBeGreaterThan(0);
    }
    expect(ssoPresetById("generic")?.helpNoteKey).toBeNull();
    expect(ssoPresetById("keycloak")?.helpNoteKey).not.toBeNull();
  });

  it("returns undefined for an unknown preset id", () => {
    expect(ssoPresetById("nope")).toBeUndefined();
  });
});
