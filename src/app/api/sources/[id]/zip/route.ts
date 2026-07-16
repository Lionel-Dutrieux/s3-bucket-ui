import type { NextRequest } from "next/server";
import { ZIP_MAX_ENTRIES } from "@/features/browser/lib/limits";
import { folderName } from "@/features/browser/lib/move";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { getZipFilesClient } from "@/lib/storage/client";

/**
 * Streams a ZIP archive. GET zips one folder (?prefix=); POST zips a
 * selection of files and folders (form fields: base, key*, prefix*) — a form
 * POST so hundreds of keys never hit URL-length limits while the browser
 * still streams the download to disk. Keys are collected up front (bounded,
 * zero-byte folder markers dropped — an empty entry name would be rejected by
 * the archive writer anyway), then files.zip() downloads entries lazily as
 * the response body is read, so memory stays flat whatever the folder holds.
 *
 * A download failure mid-stream truncates the archive — the client's unzip
 * tool reports it as corrupt. That's the honest failure mode for a stream
 * whose status line was already sent.
 */

const TOO_LARGE = Symbol("zip-too-large");

/** Collects a prefix's file keys into `keys`, bounded by ZIP_MAX_ENTRIES. */
async function collectPrefix(
  files: ReturnType<typeof getZipFilesClient>,
  prefix: string,
  keys: Set<string>,
): Promise<typeof TOO_LARGE | undefined> {
  for await (const file of files.listAll({ prefix })) {
    if (file.key.endsWith("/")) continue; // folder markers
    keys.add(file.key);
    if (keys.size > ZIP_MAX_ENTRIES) return TOO_LARGE;
  }
}

function zipResponse(
  files: ReturnType<typeof getZipFilesClient>,
  keys: Iterable<string>,
  base: string,
  filename: string,
): Response {
  // Entries are archived relative to the base folder, mirroring its layout.
  const stream = files.zip([...keys], {
    name: (key) => (key.startsWith(base) ? key.slice(base.length) : key),
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/zip">,
) {
  const { id } = await ctx.params;
  const prefix = request.nextUrl.searchParams.get("prefix");
  if (!prefix?.endsWith("/")) {
    return apiError(400, "Invalid folder.");
  }

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    return apiError(404, "Source not found.");
  }

  const files = getZipFilesClient(result.source);
  const keys = new Set<string>();
  try {
    if ((await collectPrefix(files, prefix, keys)) === TOO_LARGE) {
      return apiError(
        413,
        `This folder holds more than ${ZIP_MAX_ENTRIES} files — too large for one archive.`,
      );
    }
  } catch (error) {
    console.error(
      `[zip] listing failed (source=${result.source.id}, prefix="${prefix}"):`,
      error,
    );
    return apiError(502, "Could not read this folder.");
  }
  if (keys.size === 0) {
    return apiError(404, "This folder is empty.");
  }

  const filename = `${folderName(prefix) || result.source.bucket}.zip`;
  return zipResponse(files, keys, prefix, filename);
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/zip">,
) {
  const { id } = await ctx.params;
  const form = await request.formData();
  const base = String(form.get("base") ?? "");
  const fileKeys = form.getAll("key").map(String);
  const prefixes = form.getAll("prefix").map(String);
  if (fileKeys.length + prefixes.length === 0) {
    return apiError(400, "Nothing selected.");
  }
  if (base !== "" && !base.endsWith("/")) {
    return apiError(400, "Invalid folder.");
  }
  if (prefixes.some((prefix) => !prefix.endsWith("/"))) {
    return apiError(400, "Invalid folder.");
  }
  if (fileKeys.length + prefixes.length > ZIP_MAX_ENTRIES) {
    return apiError(
      413,
      `This selection holds more than ${ZIP_MAX_ENTRIES} entries — too large for one archive.`,
    );
  }

  const result = await requireSourceAccess(id);
  if (!result) {
    return apiError(404, "Source not found.");
  }

  const files = getZipFilesClient(result.source);
  const keys = new Set<string>(fileKeys);
  try {
    for (const prefix of prefixes) {
      if (
        keys.size > ZIP_MAX_ENTRIES ||
        (await collectPrefix(files, prefix, keys)) === TOO_LARGE
      ) {
        return apiError(
          413,
          `This selection holds more than ${ZIP_MAX_ENTRIES} files — too large for one archive.`,
        );
      }
    }
  } catch (error) {
    console.error(
      `[zip] selection listing failed (source=${result.source.id}):`,
      error,
    );
    return apiError(502, "Could not read this selection.");
  }
  if (keys.size === 0) {
    return apiError(404, "This selection is empty.");
  }

  const filename = `${
    (base ? folderName(base) : "") || result.source.bucket
  }-selection.zip`;
  return zipResponse(files, keys, base, filename);
}
