import { NextResponse, type NextRequest } from "next/server";
import { getFilesClient } from "@/features/sources/storage";
import { recordOperation } from "@/lib/dal/operations";
import { getSource } from "@/lib/dal/sources";

/**
 * Receives one file body and streams it into the bucket. The client uses
 * XMLHttpRequest against this route because fetch() has no upload progress —
 * and going through the app (instead of a presigned PUT straight to the
 * bucket) avoids requiring CORS configuration on every bucket.
 *
 * The allowUpload permission is enforced here, server-side — hiding the
 * upload UI is cosmetic, this check is the real gate.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/source/[id]/upload">,
) {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key || key.endsWith("/")) {
    return new NextResponse("Invalid key", { status: 400 });
  }

  const source = await getSource(id);
  if (!source) {
    return new NextResponse("Source not found", { status: 404 });
  }
  if (!source.allowUpload) {
    return new NextResponse("Uploads are not allowed on this source", {
      status: 403,
    });
  }

  if (!request.body) {
    return new NextResponse("Missing body", { status: 400 });
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
    return new NextResponse("Upload failed", { status: 502 });
  }
}
