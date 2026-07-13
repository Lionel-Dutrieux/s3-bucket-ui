import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import type { FileDetailsResult } from "@/features/browser/api/client";
import { getFilesClient } from "@/features/sources/server/storage";
import { getSource } from "@/lib/dal/sources";

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

  const source = await getSource(id);
  if (!source) {
    return apiError(404, "Source not found.");
  }

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
