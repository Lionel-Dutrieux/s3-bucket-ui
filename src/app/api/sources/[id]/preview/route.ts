import { type NextRequest, NextResponse } from "next/server";
import { categoryOf } from "@/features/browser/lib/file-types";
import { PREVIEW_TTL_SECONDS } from "@/features/browser/lib/limits";
import { streamObject } from "@/features/browser/server/stream";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { getFilesClient } from "@/lib/storage/client";

/** Categories rendered inline (img/iframe/video/audio tags). */
const URL_PREVIEW_CATEGORIES = new Set(["image", "pdf", "video", "audio"]);

/**
 * Preview media source — used directly as the `src` of the preview dialog's
 * media elements. Providers that can sign get a short-lived inline presigned
 * URL (no bytes through the app); the rest (SFTP, FTP, WebDAV) stream the
 * body with Range support so video scrubbing works. Only categories the
 * dialog renders safely (<img>/<video>/<audio> never execute scripts; PDFs
 * go into a sandboxed iframe) are served inline.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/preview">,
) {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return apiError(400, "Missing key.");
  }

  const filename = key.split("/").pop() || "file";
  const category = categoryOf(filename);
  if (!category || !URL_PREVIEW_CATEGORIES.has(category)) {
    return apiError(415, "This file type has no preview.");
  }

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    return apiError(404, "Source not found.");
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
    });
  } catch (error) {
    if ((error as { code?: string }).code === "NotFound") {
      return apiError(404, "File not found.");
    }
    console.error(
      `[preview] failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return apiError(502, "Could not load this preview.");
  }
}
