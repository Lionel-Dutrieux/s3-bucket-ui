"use client";

import type { Row } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteEntries,
  deleteFolder,
  deleteObject,
} from "@/features/browser/actions/entries";
import type { BrowserEntry } from "@/features/browser/lib/entries";
import { toTarget } from "@/features/browser/lib/move";

/**
 * Single- and bulk-delete flow for the browser, sharing one `deleting` pending
 * flag. `onDeleted` fires after a successful single delete; `onBulkSettled`
 * fires once the bulk delete resolves — partial failures still removed objects,
 * so it runs on failure too (the caller refreshes either way).
 */
export function useEntryDeletion({
  sourceId,
  deleteTarget,
  selectedRows,
  onDeleted,
  onBulkSettled,
}: {
  sourceId: string;
  deleteTarget: BrowserEntry | null;
  selectedRows: Row<BrowserEntry>[];
  onDeleted: () => void;
  onBulkSettled: () => void;
}) {
  const t = useTranslations("browser.fileBrowser");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result =
      deleteTarget.kind === "folder"
        ? await deleteFolder(sourceId, deleteTarget.prefix)
        : await deleteObject(sourceId, deleteTarget.key);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("deletedToast", { name: deleteTarget.name }));
    onDeleted();
  };

  const handleBulkDelete = async () => {
    const targets = selectedRows.map((row) => toTarget(row.original));
    setDeleting(true);
    const result = await deleteEntries(sourceId, targets);
    setDeleting(false);
    onBulkSettled();
    // Partial failures still deleted some objects — the caller refreshed.
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success(t("deletedToastBulk", { count: targets.length }));
    }
  };

  return { deleting, handleDelete, handleBulkDelete };
}
