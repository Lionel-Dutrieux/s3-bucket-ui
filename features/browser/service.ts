import "server-only";
import { getFilesClient } from "@/features/sources/storage";
import { partitionListing, type FolderListing } from "@/features/browser/listing";
import type { Source } from "@/lib/dal/sources";

const PAGE_SIZE = 200;

/**
 * Lists one folder level of a source. Returns null when the bucket cannot be
 * reached (revoked credentials, deleted bucket, network) — the page renders
 * its error state; details are logged server-side.
 */
export async function listFolder(
  source: Source,
  prefix: string,
  cursor?: string
): Promise<FolderListing | null> {
  try {
    const result = await getFilesClient(source).list({
      prefix,
      delimiter: "/",
      cursor,
      limit: PAGE_SIZE,
    });
    return partitionListing(result, prefix);
  } catch (error) {
    console.error(
      `[browser] listing failed (source=${source.id}, provider=${source.provider}, prefix="${prefix}"):`,
      error
    );
    return null;
  }
}
