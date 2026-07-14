import { type NextRequest, NextResponse } from "next/server";
import { categoryOf } from "@/features/browser/lib/file-types";
import { PREVIEW_TTL_SECONDS } from "@/features/browser/lib/limits";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { getFilesClient } from "@/lib/storage/client";

/** Categories rendered from a presigned URL (img/iframe/video/audio tags). */
const URL_PREVIEW_CATEGORIES = new Set(["image", "pdf", "video", "audio"]);

/**
 * Redirects to a short-lived inline presigned URL — used directly as the
 * `src` of the preview dialog's media elements, so previewing needs no client
 * fetch. Only categories the dialog can render safely (<img>/<video>/<audio>
 * never execute scripts; PDFs go into a sandboxed iframe) get an inline
 * disposition — everything else stays download-only.
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

  try {
    const signedUrl = await getFilesClient(source).url(key, {
      expiresIn: PREVIEW_TTL_SECONDS,
      responseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error(
      `[preview] signing failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return apiError(502, "Could not generate a preview link.");
  }
}
