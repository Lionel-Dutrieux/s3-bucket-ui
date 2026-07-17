import { describe, expect, it } from "vitest";
import { OPERATION_FILTERS, operationLabel } from "./operation-labels";

describe("operationLabel", () => {
  it("resolves a known action to its label key and icon", () => {
    const label = operationLabel("upload");
    expect(label.labelKey).toBe("upload");
    expect(label.icon).toBeTruthy();
  });

  it("flags destructive actions", () => {
    expect(operationLabel("delete").destructive).toBe(true);
    expect(operationLabel("sign-in-failed").destructive).toBe(true);
    expect(operationLabel("upload").destructive).toBeUndefined();
  });

  it("falls back to a null label key for unknown actions", () => {
    const label = operationLabel("who-knows");
    expect(label.labelKey).toBeNull();
    expect(label.icon).toBeTruthy();
  });
});

describe("OPERATION_FILTERS", () => {
  it("exposes every known action with a non-null label key", () => {
    expect(OPERATION_FILTERS.length).toBeGreaterThan(0);
    for (const filter of OPERATION_FILTERS) {
      expect(filter.id).toBeTypeOf("string");
      expect(filter.labelKey).not.toBeNull();
      // Each filter must round-trip back through operationLabel.
      expect(operationLabel(filter.id).labelKey).toBe(filter.labelKey);
    }
  });

  it("has unique action ids", () => {
    const ids = OPERATION_FILTERS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
