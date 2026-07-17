import "server-only";
import type { SourceInput } from "@/lib/dal/sources";
import { getFilesClient } from "@/lib/storage/client";

/**
 * Probes a source's credentials with a single-object list. Returns true when
 * the connection succeeds; logs the failure and returns false otherwise so
 * the caller can surface a translated message.
 */
export async function testConnection(data: SourceInput): Promise<boolean> {
  try {
    await getFilesClient(data).list({ limit: 1 });
    return true;
  } catch (error) {
    console.error(
      `[sources] connection test failed (provider=${data.provider}, endpoint=${data.endpoint}, bucket=${data.bucket}):`,
      error,
    );
    return false;
  }
}
