"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth/session";
import { recordOperation } from "@/lib/dal/operations";
import {
  getActiveShare,
  getShareWithSource,
  revokeShare,
} from "@/lib/dal/shares";
import { ActionError, actionClient, authActionClient } from "@/lib/safe-action";
import { verifySharePassword } from "@/lib/shares/password";
import { grantUnlock } from "@/lib/shares/unlock";

/**
 * Trades the share's password for the unlock cookie. Public by design (the
 * visitor has no session, so no auth middleware); the uniform error never
 * confirms a token exists.
 */
export const unlockShare = actionClient
  .metadata({ actionName: "shares.unlockShare" })
  .inputSchema(
    z.object({ token: z.string().min(1), password: z.string().min(1) }),
  )
  .action(async ({ parsedInput: { token, password } }) => {
    const t = await getTranslations("shares.errors");
    const share = await getActiveShare(token);
    if (!share?.passwordHash) {
      throw new ActionError(t("linkUnavailable"));
    }
    if (!verifySharePassword(password, share.passwordHash)) {
      // Blunt brute-force damper — enough for a share-link password.
      await new Promise((resolve) => setTimeout(resolve, 500));
      throw new ActionError(t("wrongPassword"));
    }
    await grantUnlock(token);
  });

/** Owners revoke their own links; admins revoke anyone's. Uniform error. */
export const revokeShareLink = authActionClient
  .metadata({ actionName: "shares.revokeShareLink" })
  .inputSchema(z.object({ id: z.string().min(1) }))
  .action(async ({ parsedInput: { id }, ctx: { user } }) => {
    const t = await getTranslations("shares.errors");
    const share = await getShareWithSource(id);
    if (!share || (share.createdById !== user.id && !isAdmin(user))) {
      throw new ActionError(t("linkNotFound"));
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
  });
