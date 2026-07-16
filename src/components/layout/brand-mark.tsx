import { cn } from "@/lib/utils";

/** Client-safe subset of Branding (src/lib/branding is server-only). */
export interface BrandingInfo {
  appName: string;
  logoUrl: string;
  hasCustomLogo: boolean;
}

/**
 * The app's brand block. Default branding renders the logo tile next to the
 * app name; a white-label logo replaces the whole block (the company mark
 * usually embeds its own wordmark).
 */
export function BrandMark({
  branding,
  subtitle,
  className,
}: {
  branding: BrandingInfo;
  subtitle?: string;
  className?: string;
}) {
  if (branding.hasCustomLogo) {
    return (
      <span className={cn("flex items-center", className)}>
        {/* biome-ignore lint/performance/noImgElement: the logo comes from a data-URL route serving arbitrary SVG/PNG — next/image does not apply. */}
        <img
          src={branding.logoUrl}
          alt={branding.appName}
          className="max-h-9 max-w-44 object-contain"
        />
      </span>
    );
  }
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {/* biome-ignore lint/performance/noImgElement: static SVG asset, no optimization needed. */}
      <img
        src={branding.logoUrl}
        alt=""
        className="size-8 shrink-0 rounded-lg"
      />
      <span className="grid text-left leading-tight">
        <span className="text-sm font-semibold tracking-tight">
          {branding.appName}
        </span>
        {subtitle ? (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}
