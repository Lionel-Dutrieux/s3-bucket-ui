import { type NextRequest, NextResponse } from "next/server";
import { categoryOf } from "@/features/browser/lib/file-types";
import { THUMBNAIL_TTL_SECONDS } from "@/features/browser/lib/limits";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { getFilesClient } from "@/lib/storage/client";

/**
 * Redirects to a short-lived inline URL for an image, so the grid can render
 * thumbnails with plain lazy-loaded <img> tags — no bytes proxied through the
 * app, and only images visible in the viewport trigger a signature.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/thumbnail">,
) {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return apiError(400, "Missing key.");
  }

  const filename = key.split("/").pop() || "file";
  if (categoryOf(filename) !== "image") {
    return apiError(415, "Not an image.");
  }

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    return apiError(404, "Source not found.");
  }
  const { source } = result;

  try {
    const signedUrl = await getFilesClient(source).url(key, {
      expiresIn: THUMBNAIL_TTL_SECONDS,
      responseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error(
      `[thumbnail] signing failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return apiError(502, "Could not generate a thumbnail link.");
  }
}
