import { describe, expect, it } from "vitest";
import { localeSchema } from "./locale-schema";

describe("localeSchema", () => {
  it("accepts every supported locale", () => {
    for (const locale of ["en", "fr", "de", "es", "zh"]) {
      expect(localeSchema.safeParse({ locale }).success).toBe(true);
    }
  });

  it("rejects unsupported locales", () => {
    expect(localeSchema.safeParse({ locale: "jp" }).success).toBe(false);
  });

  it("rejects a missing locale", () => {
    expect(localeSchema.safeParse({}).success).toBe(false);
  });
});
