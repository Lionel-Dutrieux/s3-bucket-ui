import { type NextRequest, NextResponse } from "next/server";
import { categoryOf } from "@/features/browser/lib/file-types";
import { streamObject } from "@/features/browser/server/stream";
import { sharePreviewKind } from "@/features/shares/lib/preview";
import { apiError } from "@/lib/api-error";
import { countShareDownload, getActiveShare } from "@/lib/dal/shares";
import { getSource } from "@/lib/dal/sources";
import { isUnlocked } from "@/lib/shares/unlock";
import { getFilesClient } from "@/lib/storage/client";

/** Presigned lifetime behind the stable /s/ URL — just long enough for the
 * browser to follow the redirect; the app URL is what people share. */
const REDIRECT_TTL_SECONDS = 60;

/**
 * The public download endpoint. The token is the whole authorization: no
 * session, uniform 404 for unknown/expired/revoked. Providers that can sign
 * redirect to a short-lived presigned URL (no bytes through the app); the
 * rest (SFTP, FTP, WebDAV) stream with Range support.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/s/[token]/download">,
) {
  const { token } = await ctx.params;
  const share = await getActiveShare(token);
  if (!share) return apiError(404, "Not found.");
  if (share.passwordHash && !(await isUnlocked(token))) {
    return apiError(401, "This link is password-protected.");
  }
  const source = await getSource(share.sourceId);
  if (!source) return apiError(404, "Not found.");

  const filename = share.key.split("/").pop() || "file";
  const inline =
    request.nextUrl.searchParams.get("inline") === "1" &&
    sharePreviewKind(categoryOf(filename)) !== null;
  const disposition = inline ? "inline" : "attachment";

  // Count real downloads once — not the landing page's inline preview, and
  // not every Range request a seeking <video> fires.
  if (!inline && !request.headers.get("range")) {
    await countShareDownload(share.id);
  }

  const files = getFilesClient(source);
  try {
    if (files.capabilities.signedUrl.supported) {
      // The presigned response carries the STORED Content-Type — an object
      // named photo.png but stored as text/html must never render inline at
      // the bucket origin for anonymous visitors (the streaming branch gets
      // the same guarantee from streamObject's INLINE_BLOCKED). SVG is excluded
      // for parity with INLINE_BLOCKED, which blocks svg to prevent script execution.
      const safeInline =
        inline &&
        /^(?:image\/(?!svg)|video\/|audio\/|application\/pdf$)/i.test(
          (await files.head(share.key)).type || "",
        );
      const signedDisposition = safeInline ? "inline" : "attachment";
      const url = await files.url(share.key, {
        expiresIn: REDIRECT_TTL_SECONDS,
        responseContentDisposition: `${signedDisposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      });
      return NextResponse.redirect(url);
    }
    return await streamObject(files, share.key, {
      filename,
      disposition,
      rangeHeader: request.headers.get("range"),
    });
  } catch (error) {
    if ((error as { code?: string }).code === "NotFound") {
      return apiError(404, "Not found.");
    }
    console.error(`[share-download] failed (share=${share.id}):`, error);
    return apiError(502, "Could not download this file.");
  }
}
