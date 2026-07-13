import { NextResponse, type NextRequest } from "next/server";
import { categoryOf } from "@/features/browser/file-types";
import { getFilesClient } from "@/features/sources/storage";
import { getSource } from "@/lib/dal/sources";

const THUMBNAIL_TTL_SECONDS = 600;

/**
 * Redirects to a short-lived inline URL for an image, so the grid can render
 * thumbnails with plain lazy-loaded <img> tags — no bytes proxied through the
 * app, and only images visible in the viewport trigger a signature.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/source/[id]/thumbnail">,
) {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return new NextResponse("Missing key", { status: 400 });
  }

  const filename = key.split("/").pop() || "file";
  if (categoryOf(filename) !== "image") {
    return new NextResponse("Not an image", { status: 415 });
  }

  const source = await getSource(id);
  if (!source) {
    return new NextResponse("Source not found", { status: 404 });
  }

  try {
    const signedUrl = await getFilesClient(source).url(key, {
      expiresIn: THUMBNAIL_TTL_SECONDS,
      responseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error(
      `[thumbnail] signing failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return new NextResponse("Could not generate a thumbnail link", {
      status: 502,
    });
  }
}
