import { type NextRequest, NextResponse } from "next/server";
import type { FileDetailsResult } from "@/features/browser/api/client";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { getFilesClient } from "@/lib/storage/client";

/** Object metadata for the details dialog — a HEAD request, no body. */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/details">,
): Promise<NextResponse<FileDetailsResult>> {
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

  try {
    const stored = await getFilesClient(source).head(key);
    return NextResponse.json({
      details: {
        key,
        size: stored.size,
        contentType: stored.type || undefined,
        etag: stored.etag,
        lastModified: stored.lastModified,
        metadata: stored.metadata,
      },
    });
  } catch (error) {
    console.error(
      `[details] failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return apiError(502, "Could not load the details for this file.");
  }
}
