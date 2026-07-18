import { describe, expect, it } from "vitest";
import { buildCrumbs, partitionListing } from "@/features/browser/lib/listing";

describe("partitionListing", () => {
  it("splits folders and files relative to the prefix", () => {
    const listing = partitionListing(
      {
        items: [
          { key: "docs/report.pdf", size: 100, lastModified: 1 },
          { key: "docs/notes.md", size: 200 },
        ],
        prefixes: ["docs/archive/", "docs/img/"],
        cursor: "next-token",
      },
      "docs/",
    );

    expect(listing.folders).toEqual([
      { prefix: "docs/archive/", name: "archive" },
      { prefix: "docs/img/", name: "img" },
    ]);
    expect(listing.files.map((file) => file.name)).toEqual([
      "report.pdf",
      "notes.md",
    ]);
    expect(listing.nextCursor).toBe("next-token");
  });

  it("skips zero-byte folder marker objects", () => {
    const listing = partitionListing(
      {
        items: [
          { key: "docs/", size: 0 }, // marker for the folder itself
          { key: "docs/sub/", size: 0 }, // dashboard-created marker
          { key: "docs/real.txt", size: 10 },
        ],
      },
      "docs/",
    );

    expect(listing.files.map((file) => file.name)).toEqual(["real.txt"]);
  });

  it("hides .keep markers when asked (filesystem-backed sources)", () => {
    const listing = partitionListing(
      {
        items: [
          { key: "docs/.keep", size: 0 },
          { key: "docs/real.txt", size: 10 },
        ],
      },
      "docs/",
      { hideKeepMarkers: true },
    );
    expect(listing.files.map((file) => file.name)).toEqual(["real.txt"]);
  });

  it("keeps .keep files visible by default (object stores)", () => {
    const listing = partitionListing(
      { items: [{ key: "docs/.keep", size: 0 }] },
      "docs/",
    );
    expect(listing.files.map((file) => file.name)).toEqual([".keep"]);
  });

  it("excludes the current prefix from folders", () => {
    const listing = partitionListing(
      { items: [], prefixes: ["docs/", "docs/sub/"] },
      "docs/",
    );
    expect(listing.folders).toEqual([{ prefix: "docs/sub/", name: "sub" }]);
  });
});

describe("buildCrumbs", () => {
  it("returns nothing at the root", () => {
    expect(buildCrumbs("")).toEqual([]);
  });

  it("builds one crumb per segment with cumulative prefixes", () => {
    expect(buildCrumbs("docs/2024/reports/")).toEqual([
      { label: "docs", prefix: "docs/" },
      { label: "2024", prefix: "docs/2024/" },
      { label: "reports", prefix: "docs/2024/reports/" },
    ]);
  });
});
