import { describe, expect, it } from "vitest";
import {
  basename,
  destinationFor,
  type EntryTarget,
  folderName,
  isIntoSelfOrDescendant,
  isNoop,
  parentOf,
  planMove,
} from "@/features/browser/lib/move";

const file = (key: string): EntryTarget => ({ kind: "file", key });
const folder = (prefix: string): EntryTarget => ({ kind: "folder", prefix });

describe("basename / folderName", () => {
  it("basename strips the path", () => {
    expect(basename("a/b/c.txt")).toBe("c.txt");
    expect(basename("c.txt")).toBe("c.txt");
  });
  it("folderName strips path and trailing slash", () => {
    expect(folderName("a/b/")).toBe("b");
    expect(folderName("b/")).toBe("b");
  });
});

describe("parentOf", () => {
  it("returns the containing folder, '' at root", () => {
    expect(parentOf(file("a/b/c.txt"))).toBe("a/b/");
    expect(parentOf(file("c.txt"))).toBe("");
    expect(parentOf(folder("a/b/"))).toBe("a/");
    expect(parentOf(folder("b/"))).toBe("");
  });
});

describe("destinationFor", () => {
  it("computes file and folder destinations", () => {
    expect(destinationFor(file("a/c.txt"), "x/")).toBe("x/c.txt");
    expect(destinationFor(file("a/c.txt"), "")).toBe("c.txt");
    expect(destinationFor(folder("a/b/"), "x/")).toBe("x/b/");
    expect(destinationFor(folder("a/b/"), "")).toBe("b/");
  });
});

describe("guards", () => {
  it("isNoop when already in destPrefix", () => {
    expect(isNoop(file("a/c.txt"), "a/")).toBe(true);
    expect(isNoop(file("a/c.txt"), "b/")).toBe(false);
    expect(isNoop(folder("a/b/"), "a/")).toBe(true);
  });
  it("isIntoSelfOrDescendant", () => {
    expect(isIntoSelfOrDescendant("a/b/", "a/b/")).toBe(true);
    expect(isIntoSelfOrDescendant("a/b/", "a/b/c/")).toBe(true);
    expect(isIntoSelfOrDescendant("a/b/", "a/")).toBe(false);
    expect(isIntoSelfOrDescendant("a/b/", "")).toBe(false);
  });
});

describe("planMove", () => {
  it("drops no-ops and builds move ops", () => {
    const plan = planMove([file("a/c.txt"), file("a/keep.txt")], "x/");
    expect(plan.error).toBeUndefined();
    expect(plan.moves).toEqual([
      { kind: "file", from: "a/c.txt", to: "x/c.txt" },
      { kind: "file", from: "a/keep.txt", to: "x/keep.txt" },
    ]);
  });
  it("skips a target already in the destination", () => {
    const plan = planMove([file("a/c.txt")], "a/");
    expect(plan.moves).toEqual([]);
  });
  it("rejects moving a folder into itself or a descendant", () => {
    expect(planMove([folder("a/b/")], "a/b/c/").error).toBeDefined();
    expect(planMove([folder("a/b/")], "a/b/").moves).toEqual([]);
  });
});
