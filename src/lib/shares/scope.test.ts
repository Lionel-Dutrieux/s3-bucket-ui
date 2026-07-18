import { describe, expect, it } from "vitest";
import {
  isPrefixShare,
  resolveObjectWithinPrefix,
  resolveSubPrefix,
} from "./scope";

describe("isPrefixShare", () => {
  it("is true only for the prefix kind", () => {
    expect(isPrefixShare("prefix")).toBe(true);
    expect(isPrefixShare("file")).toBe(false);
    expect(isPrefixShare("")).toBe(false);
  });
});

describe("resolveObjectWithinPrefix", () => {
  it("accepts an object genuinely under the prefix", () => {
    expect(resolveObjectWithinPrefix("photos/", "photos/a.jpg")).toBe(
      "photos/a.jpg",
    );
    expect(resolveObjectWithinPrefix("a/b/", "a/b/c/d.png")).toBe(
      "a/b/c/d.png",
    );
  });

  it("rejects the bare prefix and folder keys", () => {
    expect(resolveObjectWithinPrefix("photos/", "photos/")).toBeNull();
    expect(resolveObjectWithinPrefix("photos/", "photos/sub/")).toBeNull();
  });

  it("rejects a sibling prefix that only shares a string prefix", () => {
    // The boundary trick: startsWith without the trailing slash would pass.
    expect(
      resolveObjectWithinPrefix("photos/", "photos-secret/a.jpg"),
    ).toBeNull();
  });

  it("rejects keys outside the prefix", () => {
    expect(resolveObjectWithinPrefix("photos/", "docs/a.jpg")).toBeNull();
    expect(resolveObjectWithinPrefix("photos/", "a.jpg")).toBeNull();
  });

  it("rejects traversal and NUL tricks", () => {
    expect(
      resolveObjectWithinPrefix("photos/", "photos/../secret.txt"),
    ).toBeNull();
    expect(resolveObjectWithinPrefix("photos/", "photos/./a.jpg")).toBeNull();
    expect(resolveObjectWithinPrefix("photos/", "photos/a\0.jpg")).toBeNull();
  });

  it("rejects when the prefix is not a folder prefix", () => {
    expect(resolveObjectWithinPrefix("photos", "photos/a.jpg")).toBeNull();
    expect(resolveObjectWithinPrefix("", "a.jpg")).toBeNull();
  });

  it("rejects an empty requested key", () => {
    expect(resolveObjectWithinPrefix("photos/", "")).toBeNull();
  });
});

describe("resolveSubPrefix", () => {
  it("returns the share prefix for an empty request (the root)", () => {
    expect(resolveSubPrefix("photos/", "")).toBe("photos/");
  });

  it("accepts the share prefix itself and folders under it", () => {
    expect(resolveSubPrefix("photos/", "photos/")).toBe("photos/");
    expect(resolveSubPrefix("photos/", "photos/2024")).toBe("photos/2024/");
    expect(resolveSubPrefix("photos/", "photos/2024/")).toBe("photos/2024/");
  });

  it("rejects a sibling prefix and paths outside the share", () => {
    expect(resolveSubPrefix("photos/", "photos-secret/")).toBeNull();
    expect(resolveSubPrefix("photos/", "docs/")).toBeNull();
  });

  it("rejects traversal and NUL tricks", () => {
    expect(resolveSubPrefix("photos/", "photos/../secret")).toBeNull();
    expect(resolveSubPrefix("photos/", "photos/a\0/")).toBeNull();
  });

  it("rejects when the prefix is not a folder prefix", () => {
    expect(resolveSubPrefix("photos", "photos/")).toBeNull();
  });
});
