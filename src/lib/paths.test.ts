import { describe, expect, it } from "vitest";
import { parentPrefix } from "./paths";

describe("parentPrefix", () => {
  it("returns null at the bucket root", () => {
    expect(parentPrefix("")).toBeNull();
  });

  it("returns the root for a top-level folder", () => {
    expect(parentPrefix("docs/")).toBe("");
  });

  it("returns the parent for a nested folder", () => {
    expect(parentPrefix("docs/2024/")).toBe("docs/");
    expect(parentPrefix("a/b/c/")).toBe("a/b/");
  });

  it("ignores empty segments", () => {
    expect(parentPrefix("docs//2024/")).toBe("docs/");
  });
});
