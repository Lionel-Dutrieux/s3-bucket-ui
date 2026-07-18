import { describe, expect, it } from "vitest";
import { isPreviewable, previewKindOf } from "./preview-kind";

describe("previewKindOf", () => {
  it("maps media by category", () => {
    expect(previewKindOf("photo.JPG")).toBe("image");
    expect(previewKindOf("doc.pdf")).toBe("pdf");
    expect(previewKindOf("clip.webm")).toBe("video");
    expect(previewKindOf("song.flac")).toBe("audio");
  });

  it("video containers browsers can't decode have no preview", () => {
    expect(previewKindOf("movie.avi")).toBeUndefined();
    expect(previewKindOf("movie.mkv")).toBeUndefined();
    expect(isPreviewable("movie.avi")).toBe(false);
  });

  it("markdown and csv get their own viewers", () => {
    expect(previewKindOf("README.md")).toBe("markdown");
    expect(previewKindOf("notes.markdown")).toBe("markdown");
    expect(previewKindOf("data.csv")).toBe("csv");
  });

  it("code extensions get the code viewer", () => {
    expect(previewKindOf("app.ts")).toBe("code");
    expect(previewKindOf("config.yaml")).toBe("code");
  });

  it("plain text documents fall back to text", () => {
    expect(previewKindOf("readme.txt")).toBe("text");
    expect(previewKindOf("server.log")).toBe("text");
  });

  it("binary/unknown files have no preview", () => {
    expect(previewKindOf("archive.zip")).toBeUndefined();
    expect(previewKindOf("report.docx")).toBeUndefined();
    expect(previewKindOf("no-extension")).toBeUndefined();
    expect(isPreviewable("archive.zip")).toBe(false);
    expect(isPreviewable("photo.png")).toBe(true);
  });
});
