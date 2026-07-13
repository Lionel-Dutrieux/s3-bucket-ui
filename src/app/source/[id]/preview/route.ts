import { NextResponse, type NextRequest } from "next/server";
import { categoryOf } from "@/features/browser/lib/file-types";
import { PREVIEW_TTL_SECONDS } from "@/features/browser/lib/limits";
import { getFilesClient } from "@/features/sources/server/storage";
import { getSource } from "@/lib/dal/sources";

/** Categories rendered from a presigned URL (img/iframe/video/audio tags). */
const URL_PREVIEW_CATEGORIES = new Set(["image", "pdf", "video", "audio"]);

/**
 * Redirects to a short-lived inline presigned URL — used directly as the
 * `src` of the preview dialog's media elements, so previewing needs no client
 * fetch. Only categories the dialog can render safely (<img>/<video>/<audio>
 * never execute scripts; PDFs go into a sandboxed iframe) get an inline
 * disposition — everything else stays download-only.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/source/[id]/preview">,
) {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return new NextResponse("Missing key", { status: 400 });
  }

  const filename = key.split("/").pop() || "file";
  const category = categoryOf(filename);
  if (!category || !URL_PREVIEW_CATEGORIES.has(category)) {
    return new NextResponse("This file type has no preview", { status: 415 });
  }

  const source = await getSource(id);
  if (!source) {
    return new NextResponse("Source not found", { status: 404 });
  }

  try {
    const signedUrl = await getFilesClient(source).url(key, {
      expiresIn: PREVIEW_TTL_SECONDS,
      responseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error(
      `[preview] signing failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return new NextResponse("Could not generate a preview link", {
      status: 502,
    });
  }
}
