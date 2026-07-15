import type { FileEntry } from "@/features/browser/lib/listing";

export interface ViewerProps {
  sourceId: string;
  file: FileEntry;
  /** Media source URL (the /preview route) — media viewers use it as-is. */
  src: string;
  /** Media element failed to load — the shell shows the fallback message. */
  onError: () => void;
}
