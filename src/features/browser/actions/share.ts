"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { sourceAccessMiddleware } from "@/features/browser/server/source-access";
import { getSession } from "@/lib/auth/session";
import { recordOperation } from "@/lib/dal/operations";
import { getSharePolicy, isPublicSharingEnabled } from "@/lib/dal/settings";
import { createShare } from "@/lib/dal/shares";
import { ActionError, actionClient } from "@/lib/safe-action";
import { expiresAtFrom } from "@/lib/shares/expiry";
import { hashSharePassword } from "@/lib/shares/password";
import { capExpiresAt } from "@/lib/shares/policy";
import { generateShareToken } from "@/lib/shares/token";

const shareOptionsSchema = z.object({
  expiresIn: z.enum(["1d", "7d", "30d", "never"]),
  // Trimmed; empty means "no password".
  password: z.string().trim().max(128).optional(),
  // Download cap — omitted means unlimited. Ignored for prefix (folder) shares:
  // the cap counts single-file downloads and has no clean meaning across a whole
  // folder, so we keep the semantics simple and leave folder links uncapped.
  maxDownloads: z.number().int().min(1).optional(),
  // "file" (single object, the default) or "prefix" (a whole folder).
  kind: z.enum(["file", "prefix"]).default("file"),
});

/**
 * Mints a public share link for one object or a whole folder prefix. A read
 * grant is enough — sharing exposes nothing the creator couldn't already
 * download, so `sourceAccessMiddleware({})` only re-checks read access — but
 * the instance-wide switch (Admin → Settings) can turn the feature off
 * entirely. For kind="prefix" the key is the folder prefix (ends with "/") and
 * the public viewer lists every object beneath it.
 */
export const createShareLink = actionClient
  .metadata({
    actionName: "browser.createShareLink",
    failureKey: "browser.errors.actionFailed",
  })
  .inputSchema(
    z.object({
      sourceId: z.string().min(1),
      key: z.string(),
      options: shareOptionsSchema,
    }),
  )
  .useValidated(sourceAccessMiddleware({}))
  .action(async ({ parsedInput: { key, options }, ctx: { source, files } }) => {
    const t = await getTranslations("browser.errors");
    const isPrefix = options.kind === "prefix";
    if (isPrefix) {
      if (!key.endsWith("/")) throw new ActionError(t("onlyFoldersShareable"));
    } else if (!key || key.endsWith("/")) {
      throw new ActionError(t("onlyFilesShareable"));
    }

    if (!(await isPublicSharingEnabled())) {
      throw new ActionError(t("sharingDisabled"));
    }

    // This source may have public sharing switched off individually.
    if (!source.allowPublicShares) {
      throw new ActionError(t("sharingDisabledForSource"));
    }

    // The middleware validated the session while re-checking source access;
    // fetch it for the owner id.
    const session = await getSession();
    if (!session) throw new ActionError(t("sourceNotFound"));

    // Org-wide policy: a password may be mandatory, and the lifetime capped
    // (an over-long or "never" expiry is pulled back to the ceiling). The server
    // is the real guard — the dialog only pre-constrains the inputs.
    const policy = await getSharePolicy();
    const password = options.password || undefined;
    if (policy.requirePassword && !password) {
      throw new ActionError(t("sharePasswordRequired"));
    }

    try {
      if (isPrefix) {
        // A folder is virtual — confirm at least one object lives under it.
        const listing = await files.list({ prefix: key, limit: 1 });
        if (
          listing.items.length === 0 &&
          (listing.prefixes ?? []).length === 0
        ) {
          throw new ActionError(t("folderNoLongerExists"));
        }
      } else if (!(await files.exists(key))) {
        throw new ActionError(t("fileNoLongerExists"));
      }
    } catch (error) {
      // Missing target is a clean, translated verdict — let it through.
      if (error instanceof ActionError) throw error;
      console.error(
        `[share] exists check failed (source=${source.id}):`,
        error,
      );
      throw new ActionError(t("sourceUnreachable"));
    }

    const token = generateShareToken();
    const now = new Date();
    const expiresAt = capExpiresAt(
      expiresAtFrom(options.expiresIn, now),
      policy.maxExpiryDays,
      now,
    );
    await createShare({
      id: token,
      sourceId: source.id,
      kind: options.kind,
      key,
      createdById: session.user.id,
      expiresAt,
      passwordHash: password ? hashSharePassword(password) : null,
      // Folder links are uncapped by design (see maxDownloads note above).
      maxDownloads: isPrefix ? null : (options.maxDownloads ?? null),
    });
    await recordOperation({
      action: "share-create",
      sourceId: source.id,
      sourceName: source.name,
      target: key,
      detail: expiresAt
        ? `expires ${expiresAt.toISOString().slice(0, 10)}`
        : "no expiry",
    });
    return { token };
  });
