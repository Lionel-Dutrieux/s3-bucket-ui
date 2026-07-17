import { type NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { categoryOf } from "@/features/browser/lib/file-types";
import { PREVIEW_TTL_SECONDS } from "@/features/browser/lib/limits";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { getFilesClient } from "@/lib/storage/client";
import { streamObject } from "@/lib/storage/stream";

/** Categories rendered inline (img/iframe/video/audio tags). */
const URL_PREVIEW_CATEGORIES = new Set(["image", "pdf", "video", "audio"]);

/**
 * Preview media source — used directly as the `src` of the preview dialog's
 * media elements. Providers that can sign get a short-lived inline presigned
 * URL (no bytes through the app); the rest (SFTP, FTP, WebDAV) stream the
 * body with Range support so video scrubbing works. Only categories the
 * dialog renders safely (<img>/<video>/<audio> never execute scripts; PDFs
 * are forced to application/pdf + nosniff when streamed) are served inline.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/preview">,
) {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    const t = await getTranslations("api.errors");
    return apiError(400, t("missingKey"));
  }

  const filename = key.split("/").pop() || "file";
  const category = categoryOf(filename);
  if (!category || !URL_PREVIEW_CATEGORIES.has(category)) {
    const t = await getTranslations("api.errors");
    return apiError(415, t("noPreview"));
  }

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    const t = await getTranslations("browser.errors");
    return apiError(404, t("sourceNotFound"));
  }
  const { source } = result;

  const files = getFilesClient(source);
  try {
    if (files.capabilities.signedUrl.supported) {
      const signedUrl = await files.url(key, {
        expiresIn: PREVIEW_TTL_SECONDS,
        responseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      });
      return NextResponse.redirect(signedUrl);
    }
    return await streamObject(files, key, {
      filename,
      disposition: "inline",
      rangeHeader: request.headers.get("range"),
      // Providers often store PDFs as octet-stream; the browser only previews
      // (rather than downloads) when the response says application/pdf.
      contentType: category === "pdf" ? "application/pdf" : undefined,
    });
  } catch (error) {
    const t = await getTranslations("api.errors");
    if ((error as { code?: string }).code === "NotFound") {
      return apiError(404, t("fileNotFound"));
    }
    console.error(
      `[preview] failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return apiError(502, t("previewLoadFailed"));
  }
}
