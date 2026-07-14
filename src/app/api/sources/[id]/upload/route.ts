import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { recordOperation } from "@/lib/dal/operations";
import { getFilesClient } from "@/lib/storage/client";

/**
 * Receives one file body and streams it into the bucket. The client uses
 * XMLHttpRequest against this route because fetch() has no upload progress —
 * and going through the app (instead of a presigned PUT straight to the
 * bucket) avoids requiring CORS configuration on every bucket.
 *
 * The edit capability is enforced here, server-side — hiding the upload UI
 * is cosmetic, this check is the real gate.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/upload">,
) {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key || key.endsWith("/")) {
    return apiError(400, "Invalid key.");
  }

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    return apiError(404, "Source not found.");
  }
  const { source, access } = result;
  if (!access.canEdit) {
    return apiError(403, "You are not allowed to upload to this source.");
  }

  if (!request.body) {
    return apiError(400, "Missing body.");
  }

  try {
    await getFilesClient(source).upload(key, request.body, {
      contentType: request.headers.get("content-type") ?? undefined,
    });
    await recordOperation({
      action: "upload",
      sourceId: source.id,
      sourceName: source.name,
      target: key,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error(
      `[upload] failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return apiError(502, "Upload failed.");
  }
}
