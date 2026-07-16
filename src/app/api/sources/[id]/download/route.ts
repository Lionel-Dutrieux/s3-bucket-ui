import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { getFilesClient } from "@/lib/storage/client";
import { streamObject } from "@/lib/storage/stream";

/**
 * Download: redirects to a presigned attachment URL where the provider can
 * sign one; otherwise (SFTP, FTP, WebDAV) the body streams through the app,
 * with Range support for resumed downloads.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/download">,
) {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return apiError(400, "Missing key.");
  }

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    return apiError(404, "Source not found.");
  }
  const { source } = result;

  const files = getFilesClient(source);
  const filename = key.split("/").pop() || "download";
  try {
    if (files.capabilities.signedUrl.supported) {
      const signedUrl = await files.url(key, {
        // Forces download; also prevents stored HTML/SVG from rendering inline.
        responseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      });
      return NextResponse.redirect(signedUrl);
    }
    return await streamObject(files, key, {
      filename,
      disposition: "attachment",
      rangeHeader: request.headers.get("range"),
    });
  } catch (error) {
    if ((error as { code?: string }).code === "NotFound") {
      return apiError(404, "File not found.");
    }
    console.error(
      `[download] failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return apiError(502, "Could not download this file.");
  }
}
