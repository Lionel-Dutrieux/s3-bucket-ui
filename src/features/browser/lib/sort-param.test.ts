import { describe, expect, it } from "vitest";
import {
  parseSortParam,
  serializeSortParam,
} from "@/features/browser/lib/sort-param";

describe("parseSortParam", () => {
  it("parses a column name as ascending", () => {
    expect(parseSortParam("name")).toEqual([{ id: "name", desc: false }]);
  });

  it("parses an explicit :desc suffix", () => {
    expect(parseSortParam("size:desc")).toEqual([{ id: "size", desc: true }]);
  });

  it("rejects unknown columns and malformed values", () => {
    expect(parseSortParam("owner")).toBeNull();
    expect(parseSortParam("name:asc")).toBeNull();
    expect(parseSortParam("name:desc:extra")).toBeNull();
    expect(parseSortParam("")).toBeNull();
  });
});

describe("serializeSortParam", () => {
  it("round-trips both directions", () => {
    expect(serializeSortParam([{ id: "modified", desc: false }])).toBe(
      "modified",
    );
    expect(serializeSortParam([{ id: "modified", desc: true }])).toBe(
      "modified:desc",
    );
  });

  it("serializes an empty state to an empty string", () => {
    expect(serializeSortParam([])).toBe("");
  });
});
