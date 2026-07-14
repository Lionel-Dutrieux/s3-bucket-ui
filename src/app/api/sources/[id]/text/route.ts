import { type NextRequest, NextResponse } from "next/server";
import type { TextPreviewResult } from "@/features/browser/api/client";
import { isTextFile } from "@/features/browser/lib/file-types";
import { TEXT_PREVIEW_MAX_BYTES } from "@/features/browser/lib/limits";
import { apiError } from "@/lib/api-error";
import { getSource } from "@/lib/dal/sources";
import { getFilesClient } from "@/lib/storage/client";

/**
 * First megabyte of a text file, fetched server-side (bucket CORS never
 * allows the browser to read object bodies directly). The dialog renders it
 * as plain text in a <pre>, so content can't execute.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/text">,
): Promise<NextResponse<TextPreviewResult>> {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return apiError(400, "Missing key.");
  }

  const filename = key.split("/").pop() || "file";
  if (!isTextFile(filename)) {
    return apiError(415, "This file type has no text preview.");
  }

  const source = await getSource(id);
  if (!source) {
    return apiError(404, "Source not found.");
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
    return apiError(502, "Could not load a preview for this file.");
  }
}
