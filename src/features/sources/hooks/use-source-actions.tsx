"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { removeSource } from "@/features/sources/actions";
import type { SourceSummary } from "@/lib/dal/sources";

/**
 * Shared edit/remove behaviour for a source (sidebar menu, admin cards):
 * edit navigates to the dedicated form page, remove confirms in place —
 * mount `dialogs` once next to whatever triggers you use.
 */
export function useSourceActions(
  source: SourceSummary,
  options?: { onRemoved?: () => void },
) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const openEdit = () => {
    router.push(`/admin/sources/${source.id}/edit`);
  };

  const requestRemove = () => setConfirmOpen(true);

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeSource(source.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirmOpen(false);
      toast.success("Source removed");
      options?.onRemoved?.();
    });
  };

  const dialogs = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title={`Remove ${source.name}?`}
      description="This only removes the source here — nothing in your bucket is touched."
      confirmLabel="Remove"
      pendingLabel="Removing…"
      pending={pending}
      onConfirm={handleRemove}
    />
  );

  return { openEdit, requestRemove, pending, dialogs };
}
