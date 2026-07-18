"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { withWriteAccess } from "@/features/browser/server/guards";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { getSession } from "@/lib/auth/session";
import { createDropLink as insertDropLink } from "@/lib/dal/drops";
import { recordOperation } from "@/lib/dal/operations";
import { getSharePolicy, isPublicSharingEnabled } from "@/lib/dal/settings";
import { expiresAtFrom, type ShareExpiry } from "@/lib/shares/expiry";
import { hashSharePassword } from "@/lib/shares/password";
import { capExpiresAt } from "@/lib/shares/policy";
import { generateShareToken } from "@/lib/shares/token";

const dropOptionsSchema = z.object({
  expiresIn: z.enum(["1d", "7d", "30d", "never"]),
  // Trimmed; empty means "no password".
  password: z.string().trim().max(128).optional(),
  // Deposit cap — omitted means unlimited.
  maxFiles: z.number().int().min(1).max(10_000).optional(),
  // Per-file size cap in MiB — omitted means only the global upload ceiling.
  maxSizeMb: z.number().int().min(1).max(5_120).optional(),
  // Instruction shown to the guest — omitted means none.
  note: z.string().trim().max(500).optional(),
});

/**
 * Mints a public drop (reverse-share) link for a folder prefix (or the bucket
 * root, prefix ""). A guest holding the URL may DEPOSIT files into that prefix
 * without an account — so this is a write grant: `withWriteAccess` requires the
 * creator to hold the edit capability, and both the instance-wide public-share
 * switch and this source's own `allowPublicShares` must be on. The org share
 * policy applies exactly as it does to share links (mandatory password, capped
 * lifetime). The server is the real guard — the dialog only pre-constrains.
 */
export async function createDropLink(
  sourceId: string,
  prefix: string,
  options: {
    expiresIn: ShareExpiry;
    password?: string;
    maxFiles?: number;
    maxSizeMb?: number;
    note?: string;
  },
): Promise<ActionResult<{ token: string }>> {
  const t = await getTranslations("browser.errors");
  const parsed = dropOptionsSchema.safeParse(options);
  if (!parsed.success) return actionError(t("invalidDropOptions"));

  // "" is the bucket root; any other prefix must be a real folder prefix.
  if (prefix !== "" && !prefix.endsWith("/")) {
    return actionError(t("invalidFolder"));
  }

  if (!(await isPublicSharingEnabled())) {
    return actionError(t("sharingDisabled"));
  }

  return withWriteAccess<{ token: string }>(
    sourceId,
    {
      need: { edit: true },
      denied: t("addDenied"),
      action: "create the drop link",
    },
    async ({ source }) => {
      // This source may have public sharing switched off individually.
      if (!source.allowPublicShares) {
        return actionError(t("sharingDisabledForSource"));
      }
      // requireSourceAccess already validated the session inside the guard;
      // fetch it for the owner id (denormalized, no FK — survives deletion).
      const session = await getSession();
      if (!session) return actionError(t("sourceNotFound"));

      // Org-wide policy: a password may be mandatory, and the lifetime capped.
      const policy = await getSharePolicy();
      const password = parsed.data.password || undefined;
      if (policy.requirePassword && !password) {
        return actionError(t("sharePasswordRequired"));
      }

      const token = generateShareToken();
      const now = new Date();
      const expiresAt = capExpiresAt(
        expiresAtFrom(parsed.data.expiresIn, now),
        policy.maxExpiryDays,
        now,
      );
      await insertDropLink({
        id: token,
        sourceId: source.id,
        prefix,
        createdById: session.user.id,
        expiresAt,
        passwordHash: password ? hashSharePassword(password) : null,
        maxFiles: parsed.data.maxFiles ?? null,
        maxSizeMb: parsed.data.maxSizeMb ?? null,
        note: parsed.data.note || null,
      });
      await recordOperation({
        action: "share-create",
        sourceId: source.id,
        sourceName: source.name,
        target: prefix || "(root)",
        detail: "drop-link",
      });
      return actionOk({ token });
    },
  );
}
