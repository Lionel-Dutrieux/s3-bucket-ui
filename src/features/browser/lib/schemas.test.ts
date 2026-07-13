import { describe, expect, it } from "vitest";
import { entryNameSchema, folderNameSchema } from "./schemas";

describe("entryNameSchema", () => {
  it("accepts a plain name and trims it", () => {
    expect(entryNameSchema.parse("  report.pdf ")).toBe("report.pdf");
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(entryNameSchema.safeParse("").success).toBe(false);
    expect(entryNameSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects names containing a slash", () => {
    const result = entryNameSchema.safeParse("a/b");
    expect(result.success).toBe(false);
  });
});

describe("folderNameSchema", () => {
  it("uses folder-specific messages", () => {
    const empty = folderNameSchema.safeParse("");
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(empty.error.issues[0]?.message).toBe("Folder name is required.");
    }
  });

  it("rejects names containing a slash", () => {
    expect(folderNameSchema.safeParse("docs/2024").success).toBe(false);
  });
});
