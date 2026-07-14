import type { NextRequest } from "next/server";
import { ZIP_MAX_ENTRIES } from "@/features/browser/lib/limits";
import { folderName } from "@/features/browser/lib/move";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { getZipFilesClient } from "@/lib/storage/client";

/**
 * Streams one folder as a ZIP archive. Keys are collected up front (bounded,
 * zero-byte folder markers dropped — an empty entry name would be rejected by
 * the archive writer anyway), then files.zip() downloads entries lazily as
 * the response body is read, so memory stays flat whatever the folder holds.
 *
 * A download failure mid-stream truncates the archive — the client's unzip
 * tool reports it as corrupt. That's the honest failure mode for a stream
 * whose status line was already sent.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/zip">,
) {
  const { id } = await ctx.params;
  const prefix = request.nextUrl.searchParams.get("prefix");
  if (!prefix || !prefix.endsWith("/")) {
    return apiError(400, "Invalid folder.");
  }

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    return apiError(404, "Source not found.");
  }

  const files = getZipFilesClient(result.source);
  const keys: string[] = [];
  try {
    for await (const file of files.listAll({ prefix })) {
      if (file.key.endsWith("/")) continue; // folder markers
      keys.push(file.key);
      if (keys.length > ZIP_MAX_ENTRIES) {
        return apiError(
          413,
          `This folder holds more than ${ZIP_MAX_ENTRIES} files — too large for one archive.`,
        );
      }
    }
  } catch (error) {
    console.error(
      `[zip] listing failed (source=${result.source.id}, prefix="${prefix}"):`,
      error,
    );
    return apiError(502, "Could not read this folder.");
  }
  if (keys.length === 0) {
    return apiError(404, "This folder is empty.");
  }

  // Entries are archived relative to the folder, mirroring its layout.
  const stream = files.zip(keys, {
    name: (key) => key.slice(prefix.length),
  });

  const filename = `${folderName(prefix) || result.source.bucket}.zip`;
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
