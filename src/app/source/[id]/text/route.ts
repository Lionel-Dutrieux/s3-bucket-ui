import { NextResponse, type NextRequest } from "next/server";
import type { TextPreviewResult } from "@/features/browser/api";
import { isTextFile } from "@/features/browser/file-types";
import { TEXT_PREVIEW_MAX_BYTES } from "@/features/browser/limits";
import { getFilesClient } from "@/features/sources/storage";
import { getSource } from "@/lib/dal/sources";

/**
 * First megabyte of a text file, fetched server-side (bucket CORS never
 * allows the browser to read object bodies directly). The dialog renders it
 * as plain text in a <pre>, so content can't execute.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/source/[id]/text">,
): Promise<NextResponse<TextPreviewResult>> {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key." }, { status: 400 });
  }

  const filename = key.split("/").pop() || "file";
  if (!isTextFile(filename)) {
    return NextResponse.json(
      { error: "This file type has no text preview." },
      { status: 415 },
    );
  }

  const source = await getSource(id);
  if (!source) {
    return NextResponse.json({ error: "Source not found." }, { status: 404 });
  }

  try {
    const stored = await getFilesClient(source).download(key, {
      range: { start: 0, end: TEXT_PREVIEW_MAX_BYTES - 1 },
    });
    const text = await stored.text();
    return NextResponse.json({
      text,
      truncated: stored.size >= TEXT_PREVIEW_MAX_BYTES,
    });
  } catch (error) {
    console.error(
      `[text-preview] failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return NextResponse.json(
      { error: "Could not load a preview for this file." },
      { status: 502 },
    );
  }
}
