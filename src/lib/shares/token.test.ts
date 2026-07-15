import { describe, expect, it } from "vitest";
import { generateShareToken } from "./token";

describe("generateShareToken", () => {
  it("returns a 22-char url-safe token", () => {
    expect(generateShareToken()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("never repeats", () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => generateShareToken()),
    );
    expect(tokens.size).toBe(200);
  });
});
