import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
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

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    return apiError(404, "Source not found.");
  }
  const { source } = result;

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
