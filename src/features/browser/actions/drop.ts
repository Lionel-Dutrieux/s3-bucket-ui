"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { sourceAccessMiddleware } from "@/features/browser/server/source-access";
import { getSession } from "@/lib/auth/session";
import { createDropLink as insertDropLink } from "@/lib/dal/drops";
import { recordOperation } from "@/lib/dal/operations";
import { getSharePolicy, isPublicSharingEnabled } from "@/lib/dal/settings";
import { ActionError, actionClient } from "@/lib/safe-action";
import { expiresAtFrom } from "@/lib/shares/expiry";
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
 * without an account — so this is a write grant: `sourceAccessMiddleware`
 * requires the creator to hold the edit capability, and both the instance-wide
 * public-share switch and this source's own `allowPublicShares` must be on. The
 * org share policy applies exactly as it does to share links (mandatory
 * password, capped lifetime). The server is the real guard — the dialog only
 * pre-constrains.
 */
export const createDropLink = actionClient
  .metadata({
    actionName: "browser.createDropLink",
    failureKey: "browser.errors.actionFailed",
  })
  .inputSchema(
    z.object({
      sourceId: z.string().min(1),
      prefix: z.string(),
      options: dropOptionsSchema,
    }),
  )
  .useValidated(
    sourceAccessMiddleware({
      need: { edit: true },
      deniedKey: "browser.errors.addDenied",
    }),
  )
  .action(async ({ parsedInput: { prefix, options }, ctx: { source } }) => {
    const t = await getTranslations("browser.errors");

    // "" is the bucket root; any other prefix must be a real folder prefix.
    if (prefix !== "" && !prefix.endsWith("/")) {
      throw new ActionError(t("invalidFolder"));
    }

    if (!(await isPublicSharingEnabled())) {
      throw new ActionError(t("sharingDisabled"));
    }

    // This source may have public sharing switched off individually.
    if (!source.allowPublicShares) {
      throw new ActionError(t("sharingDisabledForSource"));
    }

    // The middleware validated the session while re-checking source access;
    // fetch it for the owner id (denormalized, no FK — survives deletion).
    const session = await getSession();
    if (!session) throw new ActionError(t("sourceNotFound"));

    // Org-wide policy: a password may be mandatory, and the lifetime capped.
    const policy = await getSharePolicy();
    const password = options.password || undefined;
    if (policy.requirePassword && !password) {
      throw new ActionError(t("sharePasswordRequired"));
    }

    const token = generateShareToken();
    const now = new Date();
    const expiresAt = capExpiresAt(
      expiresAtFrom(options.expiresIn, now),
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
      maxFiles: options.maxFiles ?? null,
      maxSizeMb: options.maxSizeMb ?? null,
      note: options.note || null,
    });
    await recordOperation({
      action: "share-create",
      sourceId: source.id,
      sourceName: source.name,
      target: prefix || "(root)",
      detail: "drop-link",
    });
    return { token };
  });
