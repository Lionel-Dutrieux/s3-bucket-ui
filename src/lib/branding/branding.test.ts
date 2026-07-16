import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrandingSettings } from "@/lib/dal/settings";

const { getBrandingSettings } = vi.hoisted(() => ({
  getBrandingSettings: vi.fn<() => Promise<BrandingSettings>>(),
}));

vi.mock("@/lib/dal/settings", () => ({ getBrandingSettings }));

// getBranding is wrapped in React's `cache`, which only memoizes inside a
// render/request context. Verified outside of one (see this file's test run)
// it calls straight through — so a fresh mock return per test is enough,
// no vi.resetModules()/dynamic import dance required.
import { getBranding } from "@/lib/branding/branding";

function settings(overrides: Partial<BrandingSettings> = {}): BrandingSettings {
  return {
    appName: null,
    logo: null,
    logoVersion: null,
    primaryColor: null,
    ...overrides,
  };
}

describe("getBranding", () => {
  beforeEach(() => {
    getBrandingSettings.mockReset();
  });

  it("falls back to defaults when nothing is stored", async () => {
    getBrandingSettings.mockResolvedValue(settings());
    await expect(getBranding()).resolves.toEqual({
      appName: "Bucket UI",
      hasCustomLogo: false,
      logoUrl: "/logo.svg",
      primaryColor: null,
    });
  });

  it("falls back to the default name when the stored name is blank", async () => {
    getBrandingSettings.mockResolvedValue(settings({ appName: "  " }));
    const branding = await getBranding();
    expect(branding.appName).toBe("Bucket UI");
  });

  it("reports a custom logo and cache-busts with its version", async () => {
    getBrandingSettings.mockResolvedValue(
      settings({ logo: "data:image/svg+xml;base64,abcd", logoVersion: "123" }),
    );
    const branding = await getBranding();
    expect(branding.hasCustomLogo).toBe(true);
    expect(branding.logoUrl).toBe("/api/branding/logo?v=123");
  });

  it("defaults the cache-bust version to 0 when the logo has no version yet", async () => {
    getBrandingSettings.mockResolvedValue(
      settings({ logo: "data:image/svg+xml;base64,abcd", logoVersion: null }),
    );
    const branding = await getBranding();
    expect(branding.logoUrl).toBe("/api/branding/logo?v=0");
  });
});
