import { NextResponse, type NextRequest } from "next/server";
import type { SourceConfigResult } from "@/features/sources/api/client";
import { getSource } from "@/lib/dal/sources";

/**
 * Everything the edit form needs to pre-fill — the secret never leaves the
 * server. Fetched on demand when the edit dialog opens; the sidebar summary
 * doesn't carry endpoint/keys.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/source/[id]/config">,
): Promise<NextResponse<SourceConfigResult>> {
  const { id } = await ctx.params;
  const source = await getSource(id);
  if (!source) {
    return NextResponse.json({ error: "Source not found." }, { status: 404 });
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
