import { NextResponse, type NextRequest } from "next/server";
import { getFilesClient } from "@/features/sources/storage";
import { getSource } from "@/lib/dal/sources";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/source/[id]/download">
) {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return new NextResponse("Missing key", { status: 400 });
  }

  const source = await getSource(id);
  if (!source) {
    return new NextResponse("Source not found", { status: 404 });
  }

  const filename = key.split("/").pop() || "download";
  const signedUrl = await getFilesClient(source).url(key, {
    // Forces download; also prevents stored HTML/SVG from rendering inline.
    responseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
  });

  return NextResponse.redirect(signedUrl);
}
