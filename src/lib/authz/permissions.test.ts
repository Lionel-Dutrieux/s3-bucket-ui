import { describe, expect, it } from "vitest";
import { mergeGrants, resolveAccess } from "./permissions";

describe("mergeGrants", () => {
  it("returns null for no grants", () => {
    expect(mergeGrants([])).toBeNull();
  });

  it("ORs capabilities across grants", () => {
    expect(
      mergeGrants([
        { canEdit: true, canDelete: false },
        { canEdit: false, canDelete: true },
      ]),
    ).toEqual({ canEdit: true, canDelete: true });
  });

  it("keeps a read-only grant read-only", () => {
    expect(mergeGrants([{ canEdit: false, canDelete: false }])).toEqual({
      canEdit: false,
      canDelete: false,
    });
  });
});

describe("resolveAccess", () => {
  it("gives admins everything, grant or not", () => {
    expect(resolveAccess("admin", null)).toEqual({
      canEdit: true,
      canDelete: true,
    });
  });

  it("denies read without a grant", () => {
    expect(resolveAccess("user", null)).toBeNull();
    expect(resolveAccess(null, null)).toBeNull();
    expect(resolveAccess(undefined, null)).toBeNull();
  });

  it("maps the grant capabilities for regular users", () => {
    expect(resolveAccess("user", { canEdit: true, canDelete: false })).toEqual({
      canEdit: true,
      canDelete: false,
    });
  });

  it("a grant means read even with no extra capability", () => {
    expect(resolveAccess("user", { canEdit: false, canDelete: false })).toEqual(
      { canEdit: false, canDelete: false },
    );
  });
});
