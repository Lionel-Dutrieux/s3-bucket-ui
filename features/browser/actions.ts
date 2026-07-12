"use server";

import { categoryOf } from "@/features/browser/file-types";
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

/**
 * Short-lived inline URL for the preview dialog. Only categories the dialog
 * can render safely (<img> never executes scripts; PDFs go into a sandboxed
 * iframe) get an inline disposition — everything else stays download-only.
 */
export async function getPreviewUrl(
  sourceId: string,
  key: string,
): Promise<UrlResult> {
  const filename = key.split("/").pop() || "file";
  const category = categoryOf(filename);
  if (category !== "image" && category !== "pdf") {
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
