import { describe, expect, it } from "vitest";
import { sharePreviewKind } from "./preview";

describe("sharePreviewKind", () => {
  it("passes through the inline-safe categories", () => {
    expect(sharePreviewKind("image")).toBe("image");
    expect(sharePreviewKind("pdf")).toBe("pdf");
    expect(sharePreviewKind("video")).toBe("video");
    expect(sharePreviewKind("audio")).toBe("audio");
  });

  it("rejects categories the browser previews but the share page does not", () => {
    expect(sharePreviewKind("markdown")).toBeNull();
    expect(sharePreviewKind("csv")).toBeNull();
    expect(sharePreviewKind("code")).toBeNull();
    expect(sharePreviewKind("text")).toBeNull();
  });

  it("returns null for unknown or missing categories", () => {
    expect(sharePreviewKind("archive")).toBeNull();
    expect(sharePreviewKind("")).toBeNull();
    expect(sharePreviewKind(undefined)).toBeNull();
  });
});
