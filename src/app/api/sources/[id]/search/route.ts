import { type NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  SEARCH_MAX_RESULTS,
  SEARCH_TIMEOUT_MS,
} from "@/features/browser/lib/limits";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { getFilesClient } from "@/lib/storage/client";

export interface SearchHit {
  key: string;
  size: number;
  lastModified?: number;
}

/**
 * Source-wide key search (case-insensitive substring), streamed from
 * files.search's lazy page walk. Two bounds keep it sane on huge buckets:
 * SEARCH_MAX_RESULTS caps the matches, and an AbortSignal deadline cuts the
 * walk — whatever was found by then comes back flagged `truncated`.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/search">,
) {
  const { id } = await ctx.params;
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 256) {
    const t = await getTranslations("api.errors");
    return apiError(400, t("searchTooShort"));
  }

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    const t = await getTranslations("browser.errors");
    return apiError(404, t("sourceNotFound"));
  }

  const files = getFilesClient(result.source);
  const hits: SearchHit[] = [];
  let truncated = false;

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    for await (const file of files.search(q, {
      match: "substring",
      caseInsensitive: true,
      maxResults: SEARCH_MAX_RESULTS,
      signal: controller.signal,
    })) {
      // Zero-byte folder markers are plumbing, not results.
      if (file.key.endsWith("/")) continue;
      hits.push({
        key: file.key,
        size: file.size,
        lastModified: file.lastModified,
      });
    }
    truncated = hits.length >= SEARCH_MAX_RESULTS;
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error(
        `[search] failed (source=${result.source.id}, provider=${result.source.provider}):`,
        error,
      );
      const t = await getTranslations("api.errors");
      return apiError(502, t("searchFailed"));
    }
    truncated = true; // deadline hit: partial results are still useful
  } finally {
    clearTimeout(deadline);
  }

  return NextResponse.json({ hits, truncated });
}
