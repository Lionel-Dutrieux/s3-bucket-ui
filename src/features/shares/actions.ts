"use server";

import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { getActiveShare } from "@/lib/dal/shares";
import { verifySharePassword } from "@/lib/shares/password";
import { grantUnlock } from "@/lib/shares/unlock";

/**
 * Trades the share's password for the unlock cookie. Public by design (the
 * visitor has no session); the uniform error never confirms a token exists.
 */
export async function unlockShare(
  token: string,
  password: string,
): Promise<ActionResult> {
  const share = await getActiveShare(token);
  if (!share?.passwordHash) {
    return actionError("This link is no longer available.");
  }
  if (!verifySharePassword(password, share.passwordHash)) {
    // Blunt brute-force damper — enough for a share-link password.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return actionError("Wrong password.");
  }
  await grantUnlock(token);
  return actionOk();
}
