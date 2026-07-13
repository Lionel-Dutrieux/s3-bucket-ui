import { NextResponse, type NextRequest } from "next/server";
import type { FileDetailsResult } from "@/features/browser/api/client";
import { getFilesClient } from "@/features/sources/server/storage";
import { getSource } from "@/lib/dal/sources";

/** Object metadata for the details dialog — a HEAD request, no body. */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/source/[id]/details">,
): Promise<NextResponse<FileDetailsResult>> {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key." }, { status: 400 });
  }

  const source = await getSource(id);
  if (!source) {
    return NextResponse.json({ error: "Source not found." }, { status: 404 });
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
    return NextResponse.json(
      { error: "Could not load the details for this file." },
      { status: 502 },
    );
  }
}
