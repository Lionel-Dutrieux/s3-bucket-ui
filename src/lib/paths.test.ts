import { describe, expect, it } from "vitest";
import {
  collisionFreeName,
  parentPrefix,
  sanitizeUploadFilename,
} from "./paths";

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

describe("sanitizeUploadFilename", () => {
  it("keeps a plain filename untouched", () => {
    expect(sanitizeUploadFilename("report.pdf")).toBe("report.pdf");
    expect(sanitizeUploadFilename("my photo (2).jpg")).toBe("my photo (2).jpg");
  });

  it("strips any directory component (defeats traversal)", () => {
    expect(sanitizeUploadFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeUploadFilename("a/b/c/file.txt")).toBe("file.txt");
    expect(sanitizeUploadFilename("C:\\Users\\me\\secret.doc")).toBe(
      "secret.doc",
    );
    expect(sanitizeUploadFilename("nested\\..\\evil.sh")).toBe("evil.sh");
  });

  it("removes control characters but keeps ordinary spaces", () => {
    expect(sanitizeUploadFilename(`tab${String.fromCharCode(9)}tab.txt`)).toBe(
      "tabtab.txt",
    );
    expect(sanitizeUploadFilename(`x${String.fromCharCode(0)}y.txt`)).toBe(
      "xy.txt",
    );
    expect(sanitizeUploadFilename(`z${String.fromCharCode(127)}.txt`)).toBe(
      "z.txt",
    );
    expect(sanitizeUploadFilename("my file.txt")).toBe("my file.txt");
  });

  it("falls back for empty, dot and dot-dot names", () => {
    expect(sanitizeUploadFilename("")).toBe("file");
    expect(sanitizeUploadFilename(".")).toBe("file");
    expect(sanitizeUploadFilename("..")).toBe("file");
    expect(sanitizeUploadFilename("   ")).toBe("file");
    expect(sanitizeUploadFilename("foo/")).toBe("file");
  });

  it("preserves a leading dot on a real dotfile", () => {
    expect(sanitizeUploadFilename(".env")).toBe(".env");
  });
});

describe("collisionFreeName", () => {
  it("returns the name unchanged on the first attempt", () => {
    expect(collisionFreeName("report.pdf", 0)).toBe("report.pdf");
  });

  it("suffixes before the extension", () => {
    expect(collisionFreeName("report.pdf", 1)).toBe("report (1).pdf");
    expect(collisionFreeName("report.pdf", 2)).toBe("report (2).pdf");
  });

  it("appends when there is no extension", () => {
    expect(collisionFreeName("README", 1)).toBe("README (1)");
  });

  it("treats a dotfile's leading dot as part of the stem", () => {
    expect(collisionFreeName(".env", 1)).toBe(".env (1)");
  });

  it("suffixes only at the last dot", () => {
    expect(collisionFreeName("archive.tar.gz", 1)).toBe("archive.tar (1).gz");
  });
});
