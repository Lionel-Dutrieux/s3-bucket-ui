"use server";

import type { Files } from "files-sdk";
import { categoryOf, isTextFile } from "@/features/browser/file-types";
import { getFilesClient } from "@/features/sources/storage";
import { getSource } from "@/lib/dal/sources";

export interface UrlResult {
  url?: string;
  error?: string;
}

const SHARE_TTL_SECONDS = 3600;
const PREVIEW_TTL_SECONDS = 600;

/**
 * Presigned URL for sharing: forces a download so stored HTML/SVG can never
 * render inline at the bucket origin.
 */
export async function getShareUrl(
  sourceId: string,
  key: string,
): Promise<UrlResult> {
  const source = await getSource(sourceId);
  if (!source) return { error: "Source not found." };

  const filename = key.split("/").pop() || "file";
  try {
    const url = await getFilesClient(source).url(key, {
      expiresIn: SHARE_TTL_SECONDS,
      responseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return { url };
  } catch (error) {
    console.error(
      `[browser] share link failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return { error: "Could not create a link for this file." };
  }
}

/** Categories rendered from a presigned URL (img/iframe/video/audio tags). */
const URL_PREVIEW_CATEGORIES = new Set(["image", "pdf", "video", "audio"]);

/**
 * Short-lived inline URL for the preview dialog. Only categories the dialog
 * can render safely (<img>/<video>/<audio> never execute scripts; PDFs go
 * into a sandboxed iframe) get an inline disposition — everything else stays
 * download-only.
 */
export async function getPreviewUrl(
  sourceId: string,
  key: string,
): Promise<UrlResult> {
  const filename = key.split("/").pop() || "file";
  const category = categoryOf(filename);
  if (!category || !URL_PREVIEW_CATEGORIES.has(category)) {
    return { error: "This file type has no preview." };
  }

  const source = await getSource(sourceId);
  if (!source) return { error: "Source not found." };

  try {
    const url = await getFilesClient(source).url(key, {
      expiresIn: PREVIEW_TTL_SECONDS,
      responseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return { url };
  } catch (error) {
    console.error(
      `[browser] preview link failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return { error: "Could not load a preview for this file." };
  }
}

const TEXT_PREVIEW_MAX_BYTES = 1024 * 1024;

export interface TextPreviewResult {
  text?: string;
  /** True when the file is larger than the preview window (first 1 MiB). */
  truncated?: boolean;
  error?: string;
}

/**
 * First megabyte of a text file, fetched server-side (bucket CORS never
 * allows the browser to read object bodies directly). Rendered as plain
 * text in a <pre>, so content can't execute.
 */
export async function getTextPreview(
  sourceId: string,
  key: string,
): Promise<TextPreviewResult> {
  const filename = key.split("/").pop() || "file";
  if (!isTextFile(filename)) {
    return { error: "This file type has no text preview." };
  }

  const source = await getSource(sourceId);
  if (!source) return { error: "Source not found." };

  try {
    const stored = await getFilesClient(source).download(key, {
      range: { start: 0, end: TEXT_PREVIEW_MAX_BYTES - 1 },
    });
    const text = await stored.text();
    return { text, truncated: stored.size >= TEXT_PREVIEW_MAX_BYTES };
  } catch (error) {
    console.error(
      `[browser] text preview failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return { error: "Could not load a preview for this file." };
  }
}

export interface FileDetails {
  key: string;
  size: number;
  contentType?: string;
  etag?: string;
  lastModified?: number;
  /** User metadata stored on the object, when the provider returns it. */
  metadata?: Record<string, string>;
}

export interface FileDetailsResult {
  details?: FileDetails;
  error?: string;
}

/**
 * Creates a folder by writing the zero-byte `prefix/` marker object — the
 * same convention the provider dashboards use, and what makes an otherwise
 * empty folder appear in delimiter listings. Gated on allowUpload,
 * server-side.
 */
export async function createFolder(
  sourceId: string,
  prefix: string,
  name: string,
): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Folder name is required." };
  if (trimmed.includes("/")) {
    return { error: "Folder names can't contain “/”." };
  }

  const source = await getSource(sourceId);
  if (!source) return { error: "Source not found." };
  if (!source.allowUpload) {
    return { error: "Uploads are not allowed on this source." };
  }

  try {
    await getFilesClient(source).upload(`${prefix}${trimmed}/`, "");
    return {};
  } catch (error) {
    console.error(
      `[browser] create folder failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return { error: "Could not create the folder." };
  }
}

function invalidEntryName(name: string): string | null {
  if (!name) return "Name is required.";
  if (name.includes("/")) return "Names can't contain “/”.";
  return null;
}

/**
 * Renames one object within its folder via move (copy + delete on object
 * stores — not atomic). Writing the new key needs allowUpload, removing the
 * old one needs allowDelete, so renaming requires both.
 */
export async function renameObject(
  sourceId: string,
  key: string,
  newName: string,
): Promise<{ error?: string }> {
  const trimmed = newName.trim();
  const invalid = invalidEntryName(trimmed);
  if (invalid) return { error: invalid };

  const source = await getSource(sourceId);
  if (!source) return { error: "Source not found." };
  if (!source.allowUpload || !source.allowDelete) {
    return {
      error: "Renaming needs both upload and delete enabled on this source.",
    };
  }

  const newKey = key.slice(0, key.lastIndexOf("/") + 1) + trimmed;
  if (newKey === key) return {};

  const files = getFilesClient(source);
  try {
    if (await files.exists(newKey)) {
      return { error: "Something with that name already exists here." };
    }
    await files.move(key, newKey);
    return {};
  } catch (error) {
    console.error(
      `[browser] rename failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return { error: "Could not rename this file." };
  }
}

// Renaming a folder moves every object under it (copy + delete each) — kept
// bounded so a server action can't churn through a giant prefix.
const RENAME_FOLDER_MAX_OBJECTS = 1000;
const RENAME_FOLDER_CONCURRENCY = 10;

/** Renames a folder by moving everything under its prefix. Needs both write
 * permissions, like {@link renameObject}. */
export async function renameFolder(
  sourceId: string,
  prefix: string,
  newName: string,
): Promise<{ error?: string }> {
  if (!prefix.endsWith("/")) return { error: "Invalid folder." };
  const trimmed = newName.trim();
  const invalid = invalidEntryName(trimmed);
  if (invalid) return { error: invalid };

  const source = await getSource(sourceId);
  if (!source) return { error: "Source not found." };
  if (!source.allowUpload || !source.allowDelete) {
    return {
      error: "Renaming needs both upload and delete enabled on this source.",
    };
  }

  const parent = prefix.slice(
    0,
    prefix.lastIndexOf("/", prefix.length - 2) + 1,
  );
  const newPrefix = `${parent}${trimmed}/`;
  if (newPrefix === prefix) return {};

  const files = getFilesClient(source);
  try {
    const conflict = await files.list({ prefix: newPrefix, limit: 1 });
    if (conflict.items.length > 0) {
      return { error: "A folder with that name already exists here." };
    }

    // Collect every key first so a partially-renamed folder is detectable
    // before any move happens.
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await files.list({ prefix, cursor, limit: 1000 });
      keys.push(...page.items.map((item) => item.key));
      cursor = page.cursor;
      if (keys.length > RENAME_FOLDER_MAX_OBJECTS) {
        return {
          error: `This folder holds more than ${RENAME_FOLDER_MAX_OBJECTS} objects — too large to rename in one go.`,
        };
      }
    } while (cursor);

    for (let i = 0; i < keys.length; i += RENAME_FOLDER_CONCURRENCY) {
      await Promise.all(
        keys
          .slice(i, i + RENAME_FOLDER_CONCURRENCY)
          .map((key) => files.move(key, newPrefix + key.slice(prefix.length))),
      );
    }
    return {};
  } catch (error) {
    console.error(
      `[browser] rename folder failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return {
      error:
        "Could not rename this folder — some objects may have moved already, refresh to check.",
    };
  }
}

/**
 * Permanently deletes one object. The allowDelete permission is enforced
 * here, server-side — hiding the delete UI is cosmetic, this check is the
 * real gate.
 */
export async function deleteObject(
  sourceId: string,
  key: string,
): Promise<{ error?: string }> {
  const source = await getSource(sourceId);
  if (!source) return { error: "Source not found." };
  if (!source.allowDelete) {
    return { error: "Deletions are not allowed on this source." };
  }

  try {
    await getFilesClient(source).delete(key);
    return {};
  } catch (error) {
    console.error(
      `[browser] delete failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return { error: "Could not delete this file." };
  }
}

// One list page (S3 bulk-delete also caps at 1000 keys per call), and a
// round cap so a colossal prefix can't pin the server action forever.
const DELETE_FOLDER_BATCH = 1000;
const DELETE_FOLDER_MAX_ROUNDS = 50;

/**
 * Deletes every object under a prefix (recursive listing, no delimiter),
 * including the zero-byte folder markers, in bulk batches. Re-lists from the
 * start after each batch since deletions shift pages. Returns an error
 * message, or null when the prefix is fully gone.
 */
async function deletePrefix(
  files: Files,
  prefix: string,
): Promise<string | null> {
  for (let round = 0; round < DELETE_FOLDER_MAX_ROUNDS; round++) {
    const page = await files.list({ prefix, limit: DELETE_FOLDER_BATCH });
    if (page.items.length === 0) return null;
    const result = await files.delete(page.items.map((item) => item.key));
    if (result.errors?.length) {
      return `${result.errors.length} object${result.errors.length === 1 ? "" : "s"} could not be deleted.`;
    }
    if (!page.cursor) return null;
  }
  return "This folder is too large to delete in one go — some objects remain, run it again.";
}

/** Deletes a folder and everything inside it. Gated on allowDelete. */
export async function deleteFolder(
  sourceId: string,
  prefix: string,
): Promise<{ error?: string }> {
  // A folder prefix is never empty — refuse anything that could sweep the
  // whole bucket.
  if (!prefix.endsWith("/")) return { error: "Invalid folder." };

  const source = await getSource(sourceId);
  if (!source) return { error: "Source not found." };
  if (!source.allowDelete) {
    return { error: "Deletions are not allowed on this source." };
  }

  try {
    const error = await deletePrefix(getFilesClient(source), prefix);
    return error ? { error } : {};
  } catch (error) {
    console.error(
      `[browser] delete folder failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return { error: "Could not delete this folder." };
  }
}

export type DeleteTarget =
  | { kind: "file"; key: string }
  | { kind: "folder"; prefix: string };

const DELETE_ENTRIES_MAX = 500;

/**
 * Bulk delete for a multi-selection: files go through one native bulk
 * delete, folders each get the recursive prefix sweep. Gated on allowDelete.
 */
export async function deleteEntries(
  sourceId: string,
  targets: DeleteTarget[],
): Promise<{ error?: string }> {
  if (targets.length === 0) return {};
  if (targets.length > DELETE_ENTRIES_MAX) {
    return { error: `Select at most ${DELETE_ENTRIES_MAX} items at a time.` };
  }
  if (
    targets.some(
      (target) => target.kind === "folder" && !target.prefix.endsWith("/"),
    )
  ) {
    return { error: "Invalid folder." };
  }

  const source = await getSource(sourceId);
  if (!source) return { error: "Source not found." };
  if (!source.allowDelete) {
    return { error: "Deletions are not allowed on this source." };
  }

  const files = getFilesClient(source);
  const failures: string[] = [];
  try {
    const fileKeys = targets.flatMap((target) =>
      target.kind === "file" ? [target.key] : [],
    );
    if (fileKeys.length > 0) {
      const result = await files.delete(fileKeys);
      if (result.errors?.length) {
        failures.push(...result.errors.map(() => "file"));
      }
    }
    for (const target of targets) {
      if (target.kind === "folder") {
        const error = await deletePrefix(files, target.prefix);
        if (error) failures.push(target.prefix);
      }
    }
    return failures.length > 0
      ? {
          error: `${failures.length} item${failures.length === 1 ? "" : "s"} could not be deleted.`,
        }
      : {};
  } catch (error) {
    console.error(
      `[browser] bulk delete failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return { error: "Could not delete the selection." };
  }
}

/** Object metadata for the details dialog — a HEAD request, no body. */
export async function getFileDetails(
  sourceId: string,
  key: string,
): Promise<FileDetailsResult> {
  const source = await getSource(sourceId);
  if (!source) return { error: "Source not found." };

  try {
    const stored = await getFilesClient(source).head(key);
    return {
      details: {
        key,
        size: stored.size,
        contentType: stored.type || undefined,
        etag: stored.etag,
        lastModified: stored.lastModified,
        metadata: stored.metadata,
      },
    };
  } catch (error) {
    console.error(
      `[browser] details failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    return { error: "Could not load the details for this file." };
  }
}
