import { describe, expect, it } from "vitest";
import {
  BRANDING_LOGO_MAX_BYTES,
  brandingSchema,
  smtpSettingsSchema,
  ssoProviderSchema,
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

describe("smtpSettingsSchema", () => {
  it("accepts a full config, password optional (null = keep current)", () => {
    expect(
      smtpSettingsSchema.safeParse({
        host: "mail.example.com",
        port: 587,
        secure: false,
        user: "mailer",
        password: null,
        from: "App <app@example.com>",
      }).success,
    ).toBe(true);
  });
  it("rejects out-of-range port and empty host", () => {
    expect(
      smtpSettingsSchema.safeParse({
        host: "",
        port: 70_000,
        secure: false,
        user: null,
        password: null,
        from: "a@b.c",
      }).success,
    ).toBe(false);
  });
});

describe("ssoProviderSchema", () => {
  const valid = {
    providerId: "pocket-id",
    issuer: "https://id.example.com",
    clientId: "client",
    clientSecret: "secret",
    domain: "example.com",
    scopes: "openid profile email groups",
    groupsClaim: "groups",
  };

  it("accepts a well-formed provider", () => {
    expect(ssoProviderSchema.safeParse(valid).success).toBe(true);
  });

  it("requires an https issuer", () => {
    expect(
      ssoProviderSchema.safeParse({ ...valid, issuer: "http://id.example.com" })
        .success,
    ).toBe(false);
  });

  it("rejects a non-slug provider id and the reserved 'credential'", () => {
    expect(
      ssoProviderSchema.safeParse({ ...valid, providerId: "Pocket ID" })
        .success,
    ).toBe(false);
    expect(
      ssoProviderSchema.safeParse({ ...valid, providerId: "credential" })
        .success,
    ).toBe(false);
  });

  it("requires a bare email domain and a client secret", () => {
    expect(
      ssoProviderSchema.safeParse({ ...valid, domain: "not a domain" }).success,
    ).toBe(false);
    expect(
      ssoProviderSchema.safeParse({ ...valid, clientSecret: "" }).success,
    ).toBe(false);
  });
});
