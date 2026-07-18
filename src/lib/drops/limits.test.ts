import { describe, expect, it } from "vitest";
import { effectiveMaxUploadBytes, isWithinSizeLimit } from "./limits";

const MB = 1024 * 1024;
const GLOBAL = 100 * MB;

describe("effectiveMaxUploadBytes", () => {
  it("falls back to the global ceiling when uncapped", () => {
    expect(effectiveMaxUploadBytes(null, GLOBAL)).toBe(GLOBAL);
    expect(effectiveMaxUploadBytes(0, GLOBAL)).toBe(GLOBAL);
    expect(effectiveMaxUploadBytes(-5, GLOBAL)).toBe(GLOBAL);
  });

  it("uses the link cap when stricter", () => {
    expect(effectiveMaxUploadBytes(10, GLOBAL)).toBe(10 * MB);
  });

  it("never exceeds the global ceiling", () => {
    expect(effectiveMaxUploadBytes(1000, GLOBAL)).toBe(GLOBAL);
  });

  it("floors a fractional cap", () => {
    expect(effectiveMaxUploadBytes(2.9, GLOBAL)).toBe(2 * MB);
  });
});

describe("isWithinSizeLimit", () => {
  it("accepts a body under the cap", () => {
    expect(isWithinSizeLimit(5 * MB, 10, GLOBAL)).toBe(true);
    expect(isWithinSizeLimit(10 * MB, 10, GLOBAL)).toBe(true);
  });

  it("rejects a body over the cap", () => {
    expect(isWithinSizeLimit(11 * MB, 10, GLOBAL)).toBe(false);
  });

  it("rejects a body over the global ceiling regardless of the link cap", () => {
    expect(isWithinSizeLimit(200 * MB, null, GLOBAL)).toBe(false);
  });

  it("treats an unknown length as within bounds (stream re-checks)", () => {
    expect(isWithinSizeLimit(Number.NaN, 10, GLOBAL)).toBe(true);
    expect(isWithinSizeLimit(-1, 10, GLOBAL)).toBe(true);
  });
});
