import "server-only";
import {
  partitionListing,
  type FolderListing,
} from "@/features/browser/listing";
import { PAGE_SIZE } from "@/features/browser/limits";
import { getFilesClient } from "@/features/sources/server/storage";
import type { Source } from "@/lib/dal/sources";

export type ListErrorReason =
  | "credentials"
  | "bucket-missing"
  | "network"
  | "unknown";

export type ListFolderResult =
  | ({ ok: true } & FolderListing)
  | { ok: false; reason: ListErrorReason };

/**
 * Maps storage failures onto the small set of causes the error page can act
 * on. files-sdk wraps provider errors in a FilesError with a normalized code
 * and keeps the original in `cause`, so unmapped codes fall through to a walk
 * of the cause chain (raw AWS/Azure shapes, Node network errors).
 */
export function classifyStorageError(error: unknown): ListErrorReason {
  const topCode = (error as { code?: unknown } | null)?.code;
  if (topCode === "Unauthorized") return "credentials";
  if (topCode === "NotFound") return "bucket-missing";

  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth++) {
    const err = current as {
      name?: string;
      code?: string;
      statusCode?: number;
      $metadata?: { httpStatusCode?: number };
      cause?: unknown;
    };

    const name = err.name ?? "";
    const status = err.$metadata?.httpStatusCode ?? err.statusCode;
    if (
      [
        "AccessDenied",
        "InvalidAccessKeyId",
        "SignatureDoesNotMatch",
        "AuthenticationFailed",
      ].includes(name) ||
      status === 401 ||
      status === 403
    ) {
      return "credentials";
    }
    if (
      ["NoSuchBucket", "ContainerNotFound"].includes(name) ||
      status === 404
    ) {
      return "bucket-missing";
    }
    if (
      [
        "ENOTFOUND",
        "ECONNREFUSED",
        "ECONNRESET",
        "ETIMEDOUT",
        "EAI_AGAIN",
        "UND_ERR_CONNECT_TIMEOUT",
      ].includes(err.code ?? "") ||
      name === "TimeoutError"
    ) {
      return "network";
    }
    current = err.cause;
  }
  return "unknown";
}

/**
 * Lists one folder level of a source. Failures come back as a typed reason so
 * the page can say *why* the bucket is unreachable; details are logged
 * server-side.
 */
export async function listFolder(
  source: Source,
  prefix: string,
  cursor?: string,
): Promise<ListFolderResult> {
  try {
    const result = await getFilesClient(source).list({
      prefix,
      delimiter: "/",
      cursor,
      limit: PAGE_SIZE,
    });
    return { ok: true, ...partitionListing(result, prefix) };
  } catch (error) {
    console.error(
      `[browser] listing failed (source=${source.id}, provider=${source.provider}, prefix="${prefix}"):`,
      error,
    );
    return { ok: false, reason: classifyStorageError(error) };
  }
}
