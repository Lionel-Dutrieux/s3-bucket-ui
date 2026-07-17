import { describe, expect, it } from "vitest";
import { applyToggle } from "@/features/browser/lib/selection";

const IDS = ["a", "b", "c", "d", "e"];

describe("applyToggle", () => {
  it("selects an unselected row and anchors on it", () => {
    expect(applyToggle({}, IDS, "b", false, null)).toEqual({
      selection: { b: true },
      anchor: "b",
    });
  });

  it("deselects a selected row", () => {
    expect(applyToggle({ b: true }, IDS, "b", false, "b")).toEqual({
      selection: {},
      anchor: "b",
    });
  });

  it("shift-click selects the whole range from the anchor, in both directions", () => {
    expect(applyToggle({ b: true }, IDS, "d", true, "b").selection).toEqual({
      b: true,
      c: true,
      d: true,
    });
    expect(applyToggle({ d: true }, IDS, "b", true, "d").selection).toEqual({
      b: true,
      c: true,
      d: true,
    });
  });

  it("shift-click only adds — rows selected outside the range survive", () => {
    const result = applyToggle({ a: true, e: true }, IDS, "c", true, "a");
    expect(result.selection).toEqual({ a: true, b: true, c: true, e: true });
    expect(result.anchor).toBe("c");
  });

  it("shift-click without an anchor falls back to a plain toggle", () => {
    expect(applyToggle({}, IDS, "c", true, null)).toEqual({
      selection: { c: true },
      anchor: "c",
    });
  });

  it("shift-click on the anchor itself toggles it", () => {
    expect(applyToggle({ c: true }, IDS, "c", true, "c").selection).toEqual({});
  });

  it("falls back to a toggle when the anchor left the displayed rows (filter changed)", () => {
    const result = applyToggle({}, IDS, "b", true, "gone");
    expect(result.selection).toEqual({ b: true });
    expect(result.anchor).toBe("b");
  });

  it("does not mutate the previous selection", () => {
    const prev = { a: true };
    applyToggle(prev, IDS, "b", false, "a");
    expect(prev).toEqual({ a: true });
  });
});
