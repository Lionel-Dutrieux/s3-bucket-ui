import { type NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import type { TextPreviewResult } from "@/features/browser/api/client";
import { isTextFile } from "@/features/browser/lib/file-types";
import { TEXT_PREVIEW_MAX_BYTES } from "@/features/browser/lib/limits";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { getFilesClient } from "@/lib/storage/client";

/**
 * First megabyte of a text file, fetched server-side (bucket CORS never
 * allows the browser to read object bodies directly). The dialog renders it
 * as plain text in a <pre>, so content can't execute.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/text">,
): Promise<NextResponse<TextPreviewResult>> {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    const t = await getTranslations("api.errors");
    return apiError(400, t("missingKey"));
  }

  const filename = key.split("/").pop() || "file";
  if (!isTextFile(filename)) {
    const t = await getTranslations("api.errors");
    return apiError(415, t("noTextPreview"));
  }

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    const t = await getTranslations("browser.errors");
    return apiError(404, t("sourceNotFound"));
  }
  const { source } = result;

  try {
    const stored = await getFilesClient(source).download(key, {
      range: { start: 0, end: TEXT_PREVIEW_MAX_BYTES - 1 },
    });
    const text = await stored.text();
    return NextResponse.json({
      text,
      truncated: stored.size >= TEXT_PREVIEW_MAX_BYTES,
    });
  } catch (error) {
    console.error(
      `[text-preview] failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    const t = await getTranslations("api.errors");
    return apiError(502, t("textPreviewLoadFailed"));
  }
}
