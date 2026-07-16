import { type NextRequest, NextResponse } from "next/server";
import { categoryOf } from "@/features/browser/lib/file-types";
import { THUMBNAIL_TTL_SECONDS } from "@/features/browser/lib/limits";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { getFilesClient } from "@/lib/storage/client";
import { streamObject } from "@/lib/storage/stream";

/**
 * Grid thumbnail source. Providers that can sign get a redirect to a
 * short-lived inline URL — no bytes proxied, and only images visible in the
 * viewport trigger a signature. The rest (SFTP, FTP, WebDAV) stream the
 * image body through the app.
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

  const files = getFilesClient(source);
  try {
    if (files.capabilities.signedUrl.supported) {
      const signedUrl = await files.url(key, {
        expiresIn: THUMBNAIL_TTL_SECONDS,
        responseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      });
      return NextResponse.redirect(signedUrl);
    }
    return await streamObject(files, key, {
      filename,
      disposition: "inline",
    });
  } catch (error) {
    if ((error as { code?: string }).code === "NotFound") {
      return apiError(404, "File not found.");
    }
    console.error(
      `[thumbnail] failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return apiError(502, "Could not load this thumbnail.");
  }
}
