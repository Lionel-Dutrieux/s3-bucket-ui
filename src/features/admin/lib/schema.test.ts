import { describe, expect, it } from "vitest";
import {
  BRANDING_LOGO_MAX_BYTES,
  brandingSchema,
} from "@/features/admin/lib/schema";

const svgLogo = `data:image/svg+xml;base64,${Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>").toString("base64")}`;

describe("brandingSchema", () => {
  it("accepts a full valid payload", () => {
    const parsed = brandingSchema.safeParse({
      appName: "  Acme Cloud  ",
      primaryColor: "#2563EB",
      logo: svgLogo,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.appName).toBe("Acme Cloud");
  });

  it("accepts null color (stock theme) and absent/null logo (keep/remove)", () => {
    expect(
      brandingSchema.safeParse({
        appName: "Acme",
        primaryColor: null,
      }).success,
    ).toBe(true);
    expect(
      brandingSchema.safeParse({
        appName: "Acme",
        primaryColor: null,
        logo: null,
      }).success,
    ).toBe(true);
  });

  it("rejects an empty or too-long app name", () => {
    expect(
      brandingSchema.safeParse({ appName: "   ", primaryColor: null }).success,
    ).toBe(false);
    expect(
      brandingSchema.safeParse({ appName: "x".repeat(65), primaryColor: null })
        .success,
    ).toBe(false);
  });

  it("rejects malformed colors", () => {
    for (const primaryColor of ["2563EB", "#25E", "#25 3EB", "blue"]) {
      expect(
        brandingSchema.safeParse({ appName: "Acme", primaryColor }).success,
      ).toBe(false);
    }
  });

  it("rejects non-image data-URLs and oversized logos", () => {
    expect(
      brandingSchema.safeParse({
        appName: "Acme",
        primaryColor: null,
        logo: "data:text/html;base64,PGh0bWw+",
      }).success,
    ).toBe(false);
    const oversized = `data:image/png;base64,${"A".repeat(Math.ceil((BRANDING_LOGO_MAX_BYTES + 1024) / 3) * 4)}`;
    expect(
      brandingSchema.safeParse({
        appName: "Acme",
        primaryColor: null,
        logo: oversized,
      }).success,
    ).toBe(false);
  });
});
