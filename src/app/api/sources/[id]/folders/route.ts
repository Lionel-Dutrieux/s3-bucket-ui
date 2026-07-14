import { type NextRequest, NextResponse } from "next/server";
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
    return apiError(400, "Invalid folder.");
  }

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    return apiError(404, "Source not found.");
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
    return apiError(502, "Could not list this folder.");
  }
}
