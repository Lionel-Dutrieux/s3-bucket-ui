// Lifetimes offered by the share dialog. Shared by the dialog (options), the
// server action (zod enum over the values) and nothing else — extend here.

export const SHARE_EXPIRY_OPTIONS = [
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "never", label: "Never" },
] as const;

export type ShareExpiry = (typeof SHARE_EXPIRY_OPTIONS)[number]["value"];

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_MS: Record<Exclude<ShareExpiry, "never">, number> = {
  "1d": DAY_MS,
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
};

/** null = the link never expires. */
export function expiresAtFrom(expiry: ShareExpiry, now: Date): Date | null {
  if (expiry === "never") return null;
  return new Date(now.getTime() + EXPIRY_MS[expiry]);
}
