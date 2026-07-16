/**
 * Hex → oklch conversion and theme derivation for white labelling. From one
 * admin-picked color we derive the light/dark pair the default amber theme
 * uses: the dark variant is the same hue/chroma lifted in lightness (the
 * stock theme pairs L 0.666 light with 0.769 dark), and each mode's ring
 * borrows the other mode's primary — mirroring globals.css. The lift is
 * clamped so it never lowers lightness for brands already near-white.
 */

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export function hexToOklch(hex: string): Oklch | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  const [r, g, b] = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map(
    (v) => {
      const channel = v / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    },
  );

  // Linear sRGB → OKLab (Björn Ottosson's reference matrices).
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const c = Math.sqrt(okA * okA + okB * okB);
  let h = (Math.atan2(okB, okA) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: okL, c, h: c < 1e-4 ? 0 : h };
}

const round = (value: number) => Math.round(value * 1000) / 1000;
const fmt = ({ l, c, h }: Oklch) =>
  `oklch(${round(l)} ${round(c)} ${round(h)})`;

/** Near-white for dark brands, a hue-tinted near-black for light brands. */
function foregroundFor(color: Oklch): Oklch {
  return color.l >= 0.7
    ? { l: 0.25, c: Math.min(color.c, 0.08), h: color.h }
    : { l: 0.985, c: 0, h: 0 };
}

export function brandThemeCss(hex: string): string | null {
  const base = hexToOklch(hex);
  if (!base) return null;
  const lifted: Oklch = {
    ...base,
    l: Math.max(base.l, Math.min(base.l + 0.1, 0.92)),
  };
  const lightFg = foregroundFor(base);
  const darkFg = foregroundFor(lifted);
  return [
    ":root {",
    `  --primary: ${fmt(base)};`,
    `  --primary-foreground: ${fmt(lightFg)};`,
    `  --ring: ${fmt(lifted)};`,
    `  --sidebar-primary: ${fmt(base)};`,
    `  --sidebar-primary-foreground: ${fmt(lightFg)};`,
    "}",
    ".dark {",
    `  --primary: ${fmt(lifted)};`,
    `  --primary-foreground: ${fmt(darkFg)};`,
    `  --ring: ${fmt(base)};`,
    `  --sidebar-primary: ${fmt(lifted)};`,
    `  --sidebar-primary-foreground: ${fmt(darkFg)};`,
    "}",
  ].join("\n");
}
