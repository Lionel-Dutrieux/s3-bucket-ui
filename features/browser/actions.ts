"use server";

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
