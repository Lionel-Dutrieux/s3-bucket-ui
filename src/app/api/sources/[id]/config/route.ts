import { type NextRequest, NextResponse } from "next/server";
import type { SourceConfigResult } from "@/features/sources/api/client";
import { apiError } from "@/lib/api-error";
import { getSession, isAdmin } from "@/lib/auth/session";
import { getSource } from "@/lib/dal/sources";

/**
 * Everything the edit form needs to pre-fill — the secret never leaves the
 * server. Fetched on demand when the edit dialog opens; the sidebar summary
 * doesn't carry endpoint/keys.
 *
 * Admin-only: the response includes the decrypted access key id, and only
 * admins manage sources. 404 (not 403) so nothing is revealed.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/config">,
): Promise<NextResponse<SourceConfigResult>> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session || !isAdmin(session.user)) {
    return apiError(404, "Source not found.");
  }
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
