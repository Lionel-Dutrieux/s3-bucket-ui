"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyToDialog } from "@/features/browser/components/dialogs/copy-to-dialog";
import { MoveDialog } from "@/features/browser/components/dialogs/move-dialog";
import { MoveToDialog } from "@/features/browser/components/dialogs/move-to-dialog";
import { PreviewDialog } from "@/features/browser/components/dialogs/preview-dialog";
import { SearchCommand } from "@/features/browser/components/dialogs/search-command";
import { ShareDialog } from "@/features/browser/components/dialogs/share-dialog";
import type { useBrowserDialogs } from "@/features/browser/hooks/use-browser-dialogs";
import type { FileEntry } from "@/features/browser/lib/listing";
import type { SharePolicy } from "@/lib/shares/policy";

/**
 * The browser's mutually-exclusive overlay stack, grouped out of FileBrowser:
 * preview, share, the delete confirmations, and the move/copy/search dialogs.
 * All wiring stays in the parent — this component only renders the overlays
 * from the dialog union (plus the URL-backed preview) so the orchestrator reads
 * as a clear sequence of sections.
 */
export function BrowserDialogs({
  sourceId,
  dialogs,
  sharePolicy,
  preview,
  previewFiles,
  onPreviewFileChange,
  onClosePreview,
  onShare,
  deleting,
  onDelete,
  onBulkDelete,
  selectedCount,
  query,
  onMutationComplete,
}: {
  sourceId: string;
  dialogs: ReturnType<typeof useBrowserDialogs>;
  /** Org-wide share constraints reflected in the share dialog. */
  sharePolicy?: SharePolicy;
  preview: FileEntry | null;
  previewFiles: FileEntry[];
  onPreviewFileChange: (file: FileEntry) => void;
  onClosePreview: () => void;
  /** Absent when sharing is disabled — hides the preview's share action. */
  onShare?: (file: FileEntry) => void;
  deleting: boolean;
  onDelete: () => void;
  onBulkDelete: () => void;
  selectedCount: number;
  query: string;
  /** Close the dialog, clear the selection and refresh — after move/copy. */
  onMutationComplete: () => void;
}) {
  const t = useTranslations("browser.fileBrowser");
  const deleteTarget =
    dialogs.dialog?.kind === "delete" ? dialogs.dialog.entry : null;

  return (
    <>
      <PreviewDialog
        sourceId={sourceId}
        file={preview}
        files={previewFiles}
        onFileChange={onPreviewFileChange}
        onOpenChange={(open) => {
          if (!open) onClosePreview();
        }}
        onShare={onShare}
      />
      <ShareDialog
        sourceId={sourceId}
        target={dialogs.dialog?.kind === "share" ? dialogs.dialog.target : null}
        policy={sharePolicy}
        onOpenChange={(open) => {
          if (!open) dialogs.close();
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) dialogs.close();
        }}
        title={t("deleteConfirmTitle", { name: deleteTarget?.name ?? "" })}
        titleClassName="break-all"
        description={
          deleteTarget?.kind === "folder"
            ? t("deleteFolderDescription")
            : t("deleteFileDescription")
        }
        confirmLabel={t("deleteConfirmLabel")}
        pendingLabel={t("deletePendingLabel")}
        pending={deleting}
        onConfirm={onDelete}
      />

      <ConfirmDialog
        open={dialogs.dialog?.kind === "bulk-delete"}
        onOpenChange={(open) => {
          if (!open && !deleting) dialogs.close();
        }}
        title={t("deleteConfirmTitleBulk", { count: selectedCount })}
        description={t("deleteBulkDescription")}
        confirmLabel={t("deleteConfirmLabel")}
        pendingLabel={t("deletePendingLabel")}
        pending={deleting}
        onConfirm={onBulkDelete}
      />

      <MoveDialog
        sourceId={sourceId}
        request={
          dialogs.dialog?.kind === "move" ? dialogs.dialog.request : null
        }
        onOpenChange={(open) => {
          if (!open) dialogs.close();
        }}
        onMoved={onMutationComplete}
      />

      <SearchCommand
        sourceId={sourceId}
        open={dialogs.dialog?.kind === "search"}
        onOpenChange={(open) => {
          if (!open) dialogs.close();
        }}
        initialQuery={query}
      />

      <MoveToDialog
        sourceId={sourceId}
        targets={
          dialogs.dialog?.kind === "move-to" ? dialogs.dialog.targets : null
        }
        onOpenChange={(open) => {
          if (!open) dialogs.close();
        }}
        onMoved={onMutationComplete}
      />

      <CopyToDialog
        sourceId={sourceId}
        targets={
          dialogs.dialog?.kind === "copy-to" ? dialogs.dialog.targets : null
        }
        onOpenChange={(open) => {
          if (!open) dialogs.close();
        }}
        onCopied={onMutationComplete}
      />
    </>
  );
}
