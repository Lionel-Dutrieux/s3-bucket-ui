import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { getSource } from "@/lib/dal/sources";
import { getFilesClient } from "@/lib/storage/client";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/download">,
) {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return apiError(400, "Missing key.");
  }

  const source = await getSource(id);
  if (!source) {
    return apiError(404, "Source not found.");
  }

  const filename = key.split("/").pop() || "download";
  try {
    const signedUrl = await getFilesClient(source).url(key, {
      // Forces download; also prevents stored HTML/SVG from rendering inline.
      responseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error(
      `[download] signing failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return apiError(502, "Could not generate a download link.");
  }
}
