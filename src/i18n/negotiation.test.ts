import { describe, expect, it } from "vitest";
import { pickLocale } from "./negotiation";

describe("pickLocale", () => {
  it("returns the default locale when the header is missing", () => {
    expect(pickLocale(null)).toBe("en");
  });
  it("picks fr from a French browser", () => {
    expect(pickLocale("fr-BE,fr;q=0.9,en;q=0.8")).toBe("fr");
  });
  it("falls back to en for unsupported languages", () => {
    expect(pickLocale("ja-JP,ja;q=0.9")).toBe("en");
  });
  it("picks a supported language over an unsupported higher-weighted one", () => {
    expect(pickLocale("ja;q=0.9,de;q=0.8")).toBe("de");
  });
  it("respects q-weights", () => {
    expect(pickLocale("en;q=0.5,fr;q=0.9")).toBe("fr");
  });
});
