// Pure org-wide share-policy logic, shared by the create action (server-side
// enforcement) and the share dialog (client-side reflection). No I/O so Vitest
// can import it directly.

import { SHARE_EXPIRY_OPTIONS, type ShareExpiry } from "./expiry";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days each expiry option represents; "never" → null (unbounded). */
export const SHARE_EXPIRY_DAYS: Record<ShareExpiry, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  never: null,
};

export interface SharePolicy {
  /** Max link lifetime in days; null = no cap (expiry stays optional). */
  maxExpiryDays: number | null;
  /** Whether a password is mandatory at creation. */
  requirePassword: boolean;
}

/**
 * Normalizes a raw cap: only a positive whole number of days caps anything —
 * absent, non-numeric, zero or negative all mean "no cap" (null).
 */
export function normalizeMaxExpiryDays(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const days = Math.floor(value);
  return days > 0 ? days : null;
}

/**
 * Caps a computed expiry instant against the org policy. When a cap is set a
 * link may live at most that long, so an unbounded ("never" → null) or
 * over-long expiry is pulled back to now + maxExpiryDays. Without a cap the
 * requested instant is returned untouched (null stays "never").
 */
export function capExpiresAt(
  expiresAt: Date | null,
  maxExpiryDays: number | null,
  now: Date,
): Date | null {
  const cap = normalizeMaxExpiryDays(maxExpiryDays);
  if (cap === null) return expiresAt;
  const ceiling = new Date(now.getTime() + cap * DAY_MS);
  if (expiresAt === null || expiresAt.getTime() > ceiling.getTime()) {
    return ceiling;
  }
  return expiresAt;
}

/**
 * The expiry options a user may pick under a policy — used to pre-constrain the
 * dialog. With a cap set, "never" and any option longer than the cap drop out;
 * the smallest option (1 day) always survives because the cap is ≥ 1 day.
 */
export function allowedExpiryOptions(
  maxExpiryDays: number | null,
): typeof SHARE_EXPIRY_OPTIONS | { value: ShareExpiry; label: string }[] {
  const cap = normalizeMaxExpiryDays(maxExpiryDays);
  if (cap === null) return SHARE_EXPIRY_OPTIONS;
  return SHARE_EXPIRY_OPTIONS.filter((option) => {
    const days = SHARE_EXPIRY_DAYS[option.value];
    return days !== null && days <= cap;
  });
}
