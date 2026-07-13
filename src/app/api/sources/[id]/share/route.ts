import { type NextRequest, NextResponse } from "next/server";
import type { UrlResult } from "@/features/browser/api/client";
import { SHARE_TTL_SECONDS } from "@/features/browser/lib/limits";
import { getFilesClient } from "@/features/sources/server/storage";
import { apiError } from "@/lib/api-error";
import { getSource } from "@/lib/dal/sources";

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

  const source = await getSource(id);
  if (!source) {
    return apiError(404, "Source not found.");
  }

  const filename = key.split("/").pop() || "file";
  try {
    const url = await getFilesClient(source).url(key, {
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
