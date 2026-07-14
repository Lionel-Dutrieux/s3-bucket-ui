import { type NextRequest, NextResponse } from "next/server";
import type { UrlResult } from "@/features/browser/api/client";
import { SHARE_TTL_SECONDS } from "@/features/browser/lib/limits";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { getFilesClient } from "@/lib/storage/client";

/**
 * Presigned URL for sharing: forces a download so stored HTML/SVG can never
 * render inline at the bucket origin. Returned as JSON (not a redirect) —
 * the client copies it to the clipboard.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/share">,
): Promise<NextResponse<UrlResult>> {
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
  // No signing primitive (SFTP, FTP, WebDAV) → no link that works without
  // the viewer's own session. The UI hides the action; this is the real gate.
  if (!files.capabilities.signedUrl.supported) {
    return apiError(
      400,
      "This source's provider can't create share links — use Download instead.",
    );
  }

  const filename = key.split("/").pop() || "file";
  try {
    const url = await files.url(key, {
      expiresIn: SHARE_TTL_SECONDS,
      responseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return NextResponse.json({ url });
  } catch (error) {
    console.error(
      `[share] signing failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return apiError(502, "Could not create a link for this file.");
  }
}
