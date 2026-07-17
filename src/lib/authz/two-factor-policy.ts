// Pure evaluation of the org-wide 2FA policy — no I/O, unit-tested.
import type { TwoFactorPolicy } from "@/lib/dal/settings";

/**
 * Whether this user must enroll in 2FA under the given policy: `all` always
 * requires it, `admins` requires it only for `role === "admin"`, `off` never
 * does.
 */
export function twoFactorRequiredFor(
  user: { role: string | null },
  policy: TwoFactorPolicy,
): boolean {
  if (policy === "all") return true;
  if (policy === "admins") return user.role === "admin";
  return false;
}
