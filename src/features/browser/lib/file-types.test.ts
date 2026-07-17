import { describe, expect, it } from "vitest";
import { categoryOf, isTextFile } from "@/features/browser/lib/file-types";

describe("categoryOf", () => {
  it("maps known extensions to their category", () => {
    expect(categoryOf("photo.png")).toBe("image");
    expect(categoryOf("clip.mp4")).toBe("video");
    expect(categoryOf("song.mp3")).toBe("audio");
    expect(categoryOf("report.pdf")).toBe("pdf");
    expect(categoryOf("data.csv")).toBe("spreadsheet");
    expect(categoryOf("main.ts")).toBe("code");
    expect(categoryOf("backup.zip")).toBe("archive");
    expect(categoryOf("notes.txt")).toBe("document");
  });

  it("is case-insensitive on the extension", () => {
    expect(categoryOf("PHOTO.PNG")).toBe("image");
    expect(categoryOf("Report.Pdf")).toBe("pdf");
  });

  it("uses the last extension of a multi-dot name", () => {
    expect(categoryOf("archive.tar.gz")).toBe("archive");
    expect(categoryOf("component.test.tsx")).toBe("code");
  });

  it("returns undefined for unknown or missing extensions", () => {
    expect(categoryOf("binary.exe")).toBeUndefined();
    expect(categoryOf("README")).toBeUndefined();
    expect(categoryOf("")).toBeUndefined();
  });
});

describe("isTextFile", () => {
  it("accepts code and plain-text document extensions", () => {
    expect(isTextFile("main.py")).toBe(true);
    expect(isTextFile("config.yaml")).toBe(true);
    expect(isTextFile("notes.txt")).toBe(true);
    expect(isTextFile("README.md")).toBe(true);
    expect(isTextFile("server.log")).toBe(true);
    expect(isTextFile("data.csv")).toBe(true);
  });

  it("rejects binary documents and media", () => {
    expect(isTextFile("letter.docx")).toBe(false);
    expect(isTextFile("sheet.xlsx")).toBe(false);
    expect(isTextFile("report.pdf")).toBe(false);
    expect(isTextFile("photo.png")).toBe(false);
    expect(isTextFile("README")).toBe(false);
  });
});
