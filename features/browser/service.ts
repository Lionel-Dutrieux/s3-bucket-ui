import "server-only";
import { getFilesClient } from "@/features/sources/storage";
import { partitionListing, type FolderListing } from "@/features/browser/listing";
import type { Source } from "@/lib/dal/sources";

const PAGE_SIZE = 200;

export type ListErrorReason =
  | "credentials"
  | "bucket-missing"
  | "network"
  | "unknown";

export type ListFolderResult =
  | ({ ok: true } & FolderListing)
  | { ok: false; reason: ListErrorReason };

/**
 * Maps provider SDK errors (AWS S3 shapes, Azure REST errors, Node network
 * failures) onto the small set of causes the error page can act on.
 */
export function classifyStorageError(error: unknown): ListErrorReason {
  const err = error as {
    name?: string;
    code?: string;
    statusCode?: number;
    $metadata?: { httpStatusCode?: number };
    cause?: { code?: string };
  } | null;

  const name = err?.name ?? "";
  const status = err?.$metadata?.httpStatusCode ?? err?.statusCode;
  if (
    ["AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch", "AuthenticationFailed"].includes(name) ||
    status === 401 ||
    status === 403
  ) {
    return "credentials";
  }
  if (["NoSuchBucket", "ContainerNotFound"].includes(name) || status === 404) {
    return "bucket-missing";
  }

  const code = err?.code ?? err?.cause?.code ?? "";
  if (
    ["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"].includes(code) ||
    name === "TimeoutError"
  ) {
    return "network";
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
  cursor?: string
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
      error
    );
    return { ok: false, reason: classifyStorageError(error) };
  }
}
