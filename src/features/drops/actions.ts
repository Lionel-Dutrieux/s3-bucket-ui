"use server";

import { getTranslations } from "next-intl/server";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { getSession, isAdmin } from "@/lib/auth/session";
import {
  getActiveDropLink,
  getDropLinkWithSource,
  revokeDropLink,
} from "@/lib/dal/drops";
import { recordOperation } from "@/lib/dal/operations";
import { grantDropUnlock } from "@/lib/drops/unlock";
import { verifySharePassword } from "@/lib/shares/password";

/**
 * Trades the drop link's password for the unlock cookie. Public by design (the
 * visitor has no session); the uniform error never confirms a token exists.
 */
export async function unlockDropLink(
  token: string,
  password: string,
): Promise<ActionResult> {
  const t = await getTranslations("shares.errors");
  const drop = await getActiveDropLink(token);
  if (!drop?.passwordHash) {
    return actionError(t("linkUnavailable"));
  }
  if (!verifySharePassword(password, drop.passwordHash)) {
    // Blunt brute-force damper — enough for a link password.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return actionError(t("wrongPassword"));
  }
  await grantDropUnlock(token);
  return actionOk();
}

/** Owners revoke their own drop links; admins revoke anyone's. Uniform error. */
export async function revokeDropLinkAction(id: string): Promise<ActionResult> {
  const t = await getTranslations("shares.errors");
  const session = await getSession();
  if (!session) return actionError(t("linkNotFound"));
  const drop = await getDropLinkWithSource(id);
  if (
    !drop ||
    (drop.createdById !== session.user.id && !isAdmin(session.user))
  ) {
    return actionError(t("linkNotFound"));
  }
  if (!drop.revokedAt) {
    await revokeDropLink(id);
    await recordOperation({
      action: "share-revoke",
      sourceId: drop.sourceId,
      sourceName: drop.source?.name ?? "(deleted source)",
      target: drop.prefix || "(root)",
      detail: "drop-link",
    });
  }
  return actionOk();
}
