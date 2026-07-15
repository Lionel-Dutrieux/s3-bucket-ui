import { describe, expect, it } from "vitest";
import { parseCsvPreview } from "./csv";

describe("parseCsvPreview", () => {
  it("splits header and rows", () => {
    const result = parseCsvPreview("a,b,c\n1,2,3\n4,5,6", 100);
    expect(result.header).toEqual(["a", "b", "c"]);
    expect(result.rows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
    expect(result.truncatedRows).toBe(false);
  });

  it("handles quoted fields with commas, newlines and escaped quotes", () => {
    const text = 'name,note\n"Doe, Jane","said ""hi""\nand left"';
    const result = parseCsvPreview(text, 100);
    expect(result.rows).toEqual([["Doe, Jane", 'said "hi"\nand left']]);
  });

  it("handles CRLF and a trailing newline", () => {
    const result = parseCsvPreview("a,b\r\n1,2\r\n", 100);
    expect(result.header).toEqual(["a", "b"]);
    expect(result.rows).toEqual([["1", "2"]]);
  });

  it("caps rows and flags the truncation", () => {
    const result = parseCsvPreview("h\n1\n2\n3\n4", 2);
    expect(result.rows).toEqual([["1"], ["2"]]);
    expect(result.truncatedRows).toBe(true);
  });

  it("empty input → empty preview", () => {
    const result = parseCsvPreview("", 10);
    expect(result.header).toEqual([]);
    expect(result.rows).toEqual([]);
  });
});
