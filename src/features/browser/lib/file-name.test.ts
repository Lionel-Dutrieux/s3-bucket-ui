import { describe, expect, it } from "vitest";
import { splitFileName } from "./file-name";

describe("splitFileName", () => {
  it("splits a regular name at the last dot", () => {
    expect(splitFileName("photo.jpg")).toEqual({
      stem: "photo",
      ext: ".jpg",
    });
  });

  it("keeps everything before the last dot in the stem", () => {
    expect(splitFileName("archive.tar.gz")).toEqual({
      stem: "archive.tar",
      ext: ".gz",
    });
  });

  it("treats an extensionless name as all stem", () => {
    expect(splitFileName("README")).toEqual({ stem: "README", ext: "" });
  });

  it("does not treat a dotfile's leading dot as an extension separator", () => {
    expect(splitFileName(".env")).toEqual({ stem: ".env", ext: "" });
  });

  it("treats a trailing dot as part of the stem", () => {
    expect(splitFileName("weird.")).toEqual({ stem: "weird", ext: "." });
  });
});
