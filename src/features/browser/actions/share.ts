"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { requireSourceAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";
import { recordOperation } from "@/lib/dal/operations";
import { isPublicSharingEnabled } from "@/lib/dal/settings";
import { createShare } from "@/lib/dal/shares";
import { expiresAtFrom, type ShareExpiry } from "@/lib/shares/expiry";
import { hashSharePassword } from "@/lib/shares/password";
import { generateShareToken } from "@/lib/shares/token";
import { getFilesClient } from "@/lib/storage/client";

const shareOptionsSchema = z.object({
  expiresIn: z.enum(["1d", "7d", "30d", "never"]),
  // Trimmed; empty means "no password".
  password: z.string().trim().max(128).optional(),
  // Download cap — omitted means unlimited.
  maxDownloads: z.number().int().min(1).optional(),
});

/**
 * Mints a public share link for one object. A read grant is enough — sharing
 * exposes nothing the creator couldn't already download — but the instance-
 * wide switch (Admin → Settings) can turn the feature off entirely.
 */
export async function createShareLink(
  sourceId: string,
  key: string,
  options: { expiresIn: ShareExpiry; password?: string; maxDownloads?: number },
): Promise<ActionResult<{ token: string }>> {
  const t = await getTranslations("browser.errors");
  const parsed = shareOptionsSchema.safeParse(options);
  if (!parsed.success) return actionError(t("invalidShareOptions"));
  if (!key || key.endsWith("/")) return actionError(t("onlyFilesShareable"));

  if (!(await isPublicSharingEnabled())) {
    return actionError(t("sharingDisabled"));
  }
  const session = await getSession();
  const result = await requireSourceAccess(sourceId);
  if (!session || !result) return actionError(t("sourceNotFound"));
  const { source } = result;

  const files = getFilesClient(source);
  try {
    if (!(await files.exists(key))) {
      return actionError(t("fileNoLongerExists"));
    }
  } catch (error) {
    console.error(`[share] exists check failed (source=${source.id}):`, error);
    return actionError(t("sourceUnreachable"));
  }

  const token = generateShareToken();
  const expiresAt = expiresAtFrom(parsed.data.expiresIn, new Date());
  const password = parsed.data.password || undefined;
  await createShare({
    id: token,
    sourceId: source.id,
    key,
    createdById: session.user.id,
    expiresAt,
    passwordHash: password ? hashSharePassword(password) : null,
    maxDownloads: parsed.data.maxDownloads ?? null,
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
