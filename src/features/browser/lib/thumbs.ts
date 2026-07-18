// Transparent images (logos, icons) are unreadable on a flat surface that
// happens to match their color — a subtle checkerboard keeps them legible on
// both themes, and stays invisible behind opaque photos.
export const CHECKERBOARD_CLASS =
  "bg-muted/40 [background-image:linear-gradient(45deg,var(--muted)_25%,transparent_25%,transparent_75%,var(--muted)_75%),linear-gradient(45deg,var(--muted)_25%,transparent_25%,transparent_75%,var(--muted)_75%)] [background-position:0_0,10px_10px] [background-size:20px_20px]";

/** Vector files are usually logos/icons: show them whole with breathing room
 * instead of cropping to fill the frame. */
export function isVectorImage(name: string): boolean {
  return /\.svg$/i.test(name);
}
