import { type NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { PAGE_SIZE } from "@/features/browser/lib/limits";
import { partitionListing } from "@/features/browser/lib/listing";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { getFilesClient } from "@/lib/storage/client";

/**
 * Subfolders of one folder level — the lightweight listing behind the folder
 * picker of the cross-source copy dialog (files are irrelevant there).
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/folders">,
) {
  const { id } = await ctx.params;
  const prefix = request.nextUrl.searchParams.get("prefix") ?? "";
  if (prefix !== "" && !prefix.endsWith("/")) {
    const t = await getTranslations("browser.errors");
    return apiError(400, t("invalidFolder"));
  }

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    const t = await getTranslations("browser.errors");
    return apiError(404, t("sourceNotFound"));
  }

  try {
    const listing = await getFilesClient(result.source).list({
      prefix,
      delimiter: "/",
      limit: PAGE_SIZE,
    });
    const { folders } = partitionListing(listing, prefix);
    return NextResponse.json({ folders });
  } catch (error) {
    console.error(
      `[folders] listing failed (source=${result.source.id}, prefix="${prefix}"):`,
      error,
    );
    const t = await getTranslations("api.errors");
    return apiError(502, t("folderListFailed"));
  }
}
