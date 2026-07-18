"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth/session";
import {
  getActiveDropLink,
  getDropLinkWithSource,
  revokeDropLink,
} from "@/lib/dal/drops";
import { recordOperation } from "@/lib/dal/operations";
import { grantDropUnlock } from "@/lib/drops/unlock";
import { ActionError, actionClient, authActionClient } from "@/lib/safe-action";
import { verifySharePassword } from "@/lib/shares/password";

/**
 * Trades the drop link's password for the unlock cookie. Public by design (the
 * visitor has no session, so no auth middleware); the uniform error never
 * confirms a token exists.
 */
export const unlockDropLink = actionClient
  .metadata({ actionName: "drops.unlockDropLink" })
  .inputSchema(
    z.object({ token: z.string().min(1), password: z.string().min(1) }),
  )
  .action(async ({ parsedInput: { token, password } }) => {
    const t = await getTranslations("shares.errors");
    const drop = await getActiveDropLink(token);
    if (!drop?.passwordHash) {
      throw new ActionError(t("linkUnavailable"));
    }
    if (!verifySharePassword(password, drop.passwordHash)) {
      // Blunt brute-force damper — enough for a link password.
      await new Promise((resolve) => setTimeout(resolve, 500));
      throw new ActionError(t("wrongPassword"));
    }
    await grantDropUnlock(token);
  });

/** Owners revoke their own drop links; admins revoke anyone's. Uniform error. */
export const revokeDropLinkAction = authActionClient
  .metadata({ actionName: "drops.revokeDropLinkAction" })
  .inputSchema(z.object({ id: z.string().min(1) }))
  .action(async ({ parsedInput: { id }, ctx: { user } }) => {
    const t = await getTranslations("shares.errors");
    const drop = await getDropLinkWithSource(id);
    if (!drop || (drop.createdById !== user.id && !isAdmin(user))) {
      throw new ActionError(t("linkNotFound"));
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
  });
