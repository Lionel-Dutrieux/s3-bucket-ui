"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { requireSourceAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";
import { recordOperation } from "@/lib/dal/operations";
import { getSharePolicy, isPublicSharingEnabled } from "@/lib/dal/settings";
import { createShare } from "@/lib/dal/shares";
import { expiresAtFrom, type ShareExpiry } from "@/lib/shares/expiry";
import { hashSharePassword } from "@/lib/shares/password";
import { capExpiresAt } from "@/lib/shares/policy";
import { generateShareToken } from "@/lib/shares/token";
import { getFilesClient } from "@/lib/storage/client";

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
 * download — but the instance-wide switch (Admin → Settings) can turn the
 * feature off entirely. For kind="prefix" the key is the folder prefix (ends
 * with "/") and the public viewer lists every object beneath it.
 */
export async function createShareLink(
  sourceId: string,
  key: string,
  options: {
    expiresIn: ShareExpiry;
    password?: string;
    maxDownloads?: number;
    kind?: "file" | "prefix";
  },
): Promise<ActionResult<{ token: string }>> {
  const t = await getTranslations("browser.errors");
  const parsed = shareOptionsSchema.safeParse(options);
  if (!parsed.success) return actionError(t("invalidShareOptions"));
  const isPrefix = parsed.data.kind === "prefix";
  if (isPrefix) {
    if (!key.endsWith("/")) return actionError(t("onlyFoldersShareable"));
  } else if (!key || key.endsWith("/")) {
    return actionError(t("onlyFilesShareable"));
  }

  if (!(await isPublicSharingEnabled())) {
    return actionError(t("sharingDisabled"));
  }
  const session = await getSession();
  const result = await requireSourceAccess(sourceId);
  if (!session || !result) return actionError(t("sourceNotFound"));
  const { source } = result;

  // This source may have public sharing switched off individually.
  if (!source.allowPublicShares) {
    return actionError(t("sharingDisabledForSource"));
  }

  // Org-wide policy: a password may be mandatory, and the lifetime capped
  // (an over-long or "never" expiry is pulled back to the ceiling). The server
  // is the real guard — the dialog only pre-constrains the inputs.
  const policy = await getSharePolicy();
  const password = parsed.data.password || undefined;
  if (policy.requirePassword && !password) {
    return actionError(t("sharePasswordRequired"));
  }

  const files = getFilesClient(source);
  try {
    if (isPrefix) {
      // A folder is virtual — confirm at least one object lives under it.
      const listing = await files.list({ prefix: key, limit: 1 });
      if (listing.items.length === 0 && (listing.prefixes ?? []).length === 0) {
        return actionError(t("folderNoLongerExists"));
      }
    } else if (!(await files.exists(key))) {
      return actionError(t("fileNoLongerExists"));
    }
  } catch (error) {
    console.error(`[share] exists check failed (source=${source.id}):`, error);
    return actionError(t("sourceUnreachable"));
  }

  const token = generateShareToken();
  const now = new Date();
  const expiresAt = capExpiresAt(
    expiresAtFrom(parsed.data.expiresIn, now),
    policy.maxExpiryDays,
    now,
  );
  await createShare({
    id: token,
    sourceId: source.id,
    kind: parsed.data.kind,
    key,
    createdById: session.user.id,
    expiresAt,
    passwordHash: password ? hashSharePassword(password) : null,
    // Folder links are uncapped by design (see maxDownloads note above).
    maxDownloads: isPrefix ? null : (parsed.data.maxDownloads ?? null),
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
  return actionOk({ token });
}
