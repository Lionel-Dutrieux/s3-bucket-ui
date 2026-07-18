// Pure helper: a human-friendly button label from an SSO provider id
// ("pocket-id" → "Pocket Id"). No I/O, no React — safe for RSC and tests.
export function labelForProvider(providerId: string): string {
  return providerId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
