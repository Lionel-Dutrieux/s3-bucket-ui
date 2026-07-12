import { describe, expect, it } from "vitest";
import {
  matchesQuery,
  nextSort,
  sortFiles,
  sortFolders,
} from "@/features/browser/sort";

const files = [
  { key: "b.txt", name: "b.txt", size: 30, lastModified: 200 },
  { key: "a.txt", name: "a.txt", size: 10, lastModified: 300 },
  { key: "c.txt", name: "c.txt", size: 20, lastModified: undefined },
];

describe("nextSort", () => {
  it("cycles unsorted → asc → desc → unsorted", () => {
    const asc = nextSort(null, "name");
    expect(asc).toEqual({ key: "name", dir: "asc" });
    const desc = nextSort(asc, "name");
    expect(desc).toEqual({ key: "name", dir: "desc" });
    expect(nextSort(desc, "name")).toBeNull();
  });

  it("switching column restarts ascending", () => {
    expect(nextSort({ key: "name", dir: "desc" }, "size")).toEqual({
      key: "size",
      dir: "asc",
    });
  });
});

describe("sortFiles", () => {
  it("keeps the original order when unsorted", () => {
    expect(sortFiles(files, null)).toBe(files);
  });

  it("sorts by name", () => {
    expect(
      sortFiles(files, { key: "name", dir: "asc" }).map((f) => f.name),
    ).toEqual(["a.txt", "b.txt", "c.txt"]);
  });

  it("sorts by size descending", () => {
    expect(
      sortFiles(files, { key: "size", dir: "desc" }).map((f) => f.size),
    ).toEqual([30, 20, 10]);
  });

  it("treats a missing date as the oldest", () => {
    expect(
      sortFiles(files, { key: "modified", dir: "asc" }).map((f) => f.name),
    ).toEqual(["c.txt", "b.txt", "a.txt"]);
  });
});

describe("sortFolders", () => {
  const folders = [
    { prefix: "b/", name: "b" },
    { prefix: "a/", name: "a" },
  ];

  it("only reacts to the name column", () => {
    expect(sortFolders(folders, { key: "size", dir: "asc" })).toBe(folders);
    expect(
      sortFolders(folders, { key: "name", dir: "asc" }).map((f) => f.name),
    ).toEqual(["a", "b"]);
  });
});

describe("matchesQuery", () => {
  it("is case-insensitive and trims the query", () => {
    expect(matchesQuery("Report-Final.PDF", "  final ")).toBe(true);
    expect(matchesQuery("photo.jpg", "final")).toBe(false);
  });
});
