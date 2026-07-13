import { describe, expect, it } from "vitest";
import {
  type BrowserEntry,
  buildEntries,
  compareByModified,
  compareByName,
  compareBySize,
  entryMatches,
} from "@/features/browser/lib/entries";

const folder = (name: string): BrowserEntry => ({
  kind: "folder",
  prefix: `${name}/`,
  name,
});
const file = (name: string, size = 0, lastModified?: number): BrowserEntry => ({
  kind: "file",
  key: name,
  name,
  size,
  lastModified,
});

describe("buildEntries", () => {
  it("keeps folders before files", () => {
    const entries = buildEntries(
      [{ prefix: "docs/", name: "docs" }],
      [{ key: "a.txt", name: "a.txt", size: 1 }],
    );
    expect(entries.map((e) => e.kind)).toEqual(["folder", "file"]);
  });
});

describe("comparators", () => {
  it("compare names within a kind, never across kinds", () => {
    expect(compareByName(file("a"), file("b"))).toBeLessThan(0);
    expect(compareByName(folder("z"), folder("a"))).toBeGreaterThan(0);
    expect(compareByName(folder("z"), file("a"))).toBe(0);
  });

  it("size and modified only order files", () => {
    expect(compareBySize(file("a", 10), file("b", 20))).toBeLessThan(0);
    expect(compareBySize(folder("a"), file("b", 20))).toBe(0);
    expect(compareBySize(folder("a"), folder("b"))).toBe(0);
    expect(
      compareByModified(file("a", 0, 100), file("b", 0, 50)),
    ).toBeGreaterThan(0);
    expect(compareByModified(folder("a"), file("b", 0, 50))).toBe(0);
  });

  it("treats a missing date as the oldest", () => {
    expect(compareByModified(file("a"), file("b", 0, 1))).toBeLessThan(0);
  });
});

describe("entryMatches", () => {
  it("is case-insensitive and trims the query", () => {
    expect(entryMatches(file("Report-Final.PDF"), "  final ")).toBe(true);
    expect(entryMatches(folder("photos"), "final")).toBe(false);
  });
});
