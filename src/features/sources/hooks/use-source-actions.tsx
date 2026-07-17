"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("sources");

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
      toast.success(t("actions.removedToast"));
      options?.onRemoved?.();
    });
  };

  const dialogs = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title={t("actions.removeConfirmTitle", { name: source.name })}
      description={t("actions.removeConfirmDescription")}
      confirmLabel={t("remove")}
      pendingLabel={t("actions.removePendingLabel")}
      pending={pending}
      onConfirm={handleRemove}
    />
  );

  return { openEdit, requestRemove, pending, dialogs };
}
