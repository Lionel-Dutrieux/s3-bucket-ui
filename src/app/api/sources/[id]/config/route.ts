import { type NextRequest, NextResponse } from "next/server";
import type { SourceConfigResult } from "@/features/sources/api/client";
import { apiError } from "@/lib/api-error";
import { getSource } from "@/lib/dal/sources";

/**
 * Everything the edit form needs to pre-fill — the secret never leaves the
 * server. Fetched on demand when the edit dialog opens; the sidebar summary
 * doesn't carry endpoint/keys.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/config">,
): Promise<NextResponse<SourceConfigResult>> {
  const { id } = await ctx.params;
  const source = await getSource(id);
  if (!source) {
    return apiError(404, "Source not found.");
  }

  return NextResponse.json({
    source: {
      name: source.name,
      provider: source.provider,
      endpoint: source.endpoint,
      bucket: source.bucket,
      accessKeyId: source.accessKeyId,
      allowUpload: source.allowUpload,
      allowDelete: source.allowDelete,
    },
  });
}
