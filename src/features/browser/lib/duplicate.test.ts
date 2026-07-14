import { describe, expect, it } from "vitest";
import { duplicateKeyCandidate } from "@/features/browser/lib/duplicate";

describe("duplicateKeyCandidate", () => {
  it("inserts the suffix before the extension", () => {
    expect(duplicateKeyCandidate("docs/report.pdf", 1)).toBe(
      "docs/report (copy).pdf",
    );
  });

  it("numbers later attempts", () => {
    expect(duplicateKeyCandidate("docs/report.pdf", 3)).toBe(
      "docs/report (copy 3).pdf",
    );
  });

  it("keeps only the last extension of a multi-dot name", () => {
    expect(duplicateKeyCandidate("archive.tar.gz", 1)).toBe(
      "archive.tar (copy).gz",
    );
  });

  it("appends to extensionless names", () => {
    expect(duplicateKeyCandidate("bin/Makefile", 1)).toBe(
      "bin/Makefile (copy)",
    );
  });

  it("treats a dotfile's leading dot as part of the name", () => {
    expect(duplicateKeyCandidate(".env", 1)).toBe(".env (copy)");
  });

  it("works at the bucket root", () => {
    expect(duplicateKeyCandidate("photo.jpg", 2)).toBe("photo (copy 2).jpg");
  });
});
