import { type NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
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
    const t = await getTranslations("api.errors");
    return apiError(400, t("missingKey"));
  }

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    const t = await getTranslations("browser.errors");
    return apiError(404, t("sourceNotFound"));
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
    const t = await getTranslations("api.errors");
    return apiError(502, t("detailsLoadFailed"));
  }
}
