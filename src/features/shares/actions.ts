"use server";

import { getTranslations } from "next-intl/server";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { getSession, isAdmin } from "@/lib/auth/session";
import { recordOperation } from "@/lib/dal/operations";
import {
  getActiveShare,
  getShareWithSource,
  revokeShare,
} from "@/lib/dal/shares";
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
  const t = await getTranslations("shares.errors");
  const share = await getActiveShare(token);
  if (!share?.passwordHash) {
    return actionError(t("linkUnavailable"));
  }
  if (!verifySharePassword(password, share.passwordHash)) {
    // Blunt brute-force damper — enough for a share-link password.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return actionError(t("wrongPassword"));
  }
  await grantUnlock(token);
  return actionOk();
}

/** Owners revoke their own links; admins revoke anyone's. Uniform error. */
export async function revokeShareLink(id: string): Promise<ActionResult> {
  const t = await getTranslations("shares.errors");
  const session = await getSession();
  if (!session) return actionError(t("linkNotFound"));
  const share = await getShareWithSource(id);
  if (
    !share ||
    (share.createdById !== session.user.id && !isAdmin(session.user))
  ) {
    return actionError(t("linkNotFound"));
  }
  if (!share.revokedAt) {
    await revokeShare(id);
    await recordOperation({
      action: "share-revoke",
      sourceId: share.sourceId,
      sourceName: share.source?.name ?? "(deleted source)",
      target: share.key,
    });
  }
  return actionOk();
}
