import "server-only";
import { transfer } from "files-sdk";
import { recordOperation } from "@/lib/dal/operations";
import type { Source } from "@/lib/dal/sources";
import { getFilesClient } from "@/lib/storage/client";

export interface MigrationSummary {
  transferred: number;
  skipped: number;
  failed: number;
}

/**
 * Copies every object of one source into another — files-sdk's transfer()
 * streams each body download-to-upload, so this works across providers
 * (S3 → Azure, R2 → S3, …) without buffering. Existing destination keys are
 * skipped, the source is never modified, and per-key failures don't abort
 * the run: the summary reports transferred / skipped / failed counts. Records
 * the operation in the audit log; throws on an unexpected failure.
 */
export async function transferSourceContents(
  from: Source,
  to: Source,
): Promise<MigrationSummary> {
  const result = await transfer(getFilesClient(from), getFilesClient(to), {
    overwrite: false, // never clobber what the destination already holds
  });
  const summary: MigrationSummary = {
    transferred: result.transferred.length,
    skipped: result.skipped?.length ?? 0,
    failed: result.errors?.length ?? 0,
  };
  if (result.errors?.length) {
    console.error(
      `[sources] migration ${from.name} → ${to.name}: ${result.errors.length} failed`,
      result.errors.slice(0, 5),
    );
  }
  await recordOperation({
    action: "migrate",
    sourceId: from.id,
    sourceName: from.name,
    target: `→ ${to.name}`,
    detail: `${summary.transferred} copied, ${summary.skipped} skipped${summary.failed ? `, ${summary.failed} failed` : ""}`,
  });
  return summary;
}
