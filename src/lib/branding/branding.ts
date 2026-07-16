import "server-only";
import { cache } from "react";
import { getBrandingSettings } from "@/lib/dal/settings";

export const DEFAULT_APP_NAME = "Bucket UI";

export interface Branding {
  appName: string;
  /** What an <img src> should render: custom logo route or the bundled default. */
  logoUrl: string;
  hasCustomLogo: boolean;
  /** #RRGGBB, or null for the stock theme. */
  primaryColor: string | null;
}

/**
 * Request-memoized branding snapshot. Every consumer (metadata, layouts,
 * the share page) shares one DB read per request.
 */
export const getBranding = cache(async (): Promise<Branding> => {
  const settings = await getBrandingSettings();
  const hasCustomLogo = Boolean(settings.logo);
  return {
    appName: settings.appName?.trim() || DEFAULT_APP_NAME,
    hasCustomLogo,
    logoUrl: hasCustomLogo
      ? `/api/branding/logo?v=${settings.logoVersion ?? "0"}`
      : "/logo.svg",
    primaryColor: settings.primaryColor,
  };
});
