"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { removeSource } from "@/features/sources/actions";
import { sourcesQueries } from "@/features/sources/api/queries";
import { SourceForm } from "@/features/sources/components/source-form";
import type { SourceFormValues } from "@/features/sources/lib/schema";
import type { SourceSummary } from "@/lib/dal/sources";

/**
 * Shared edit/remove behaviour for a source (sidebar menu, admin cards):
 * exposes the two entry points and renders the dialogs itself — mount
 * `dialogs` once next to whatever triggers you use.
 */
export function useSourceActions(
  source: SourceSummary,
  options?: { onRemoved?: () => void },
) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editValues, setEditValues] = useState<SourceFormValues | null>(null);
  const [pending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  // Summaries don't carry endpoint/keys — fetch the full record (minus the
  // secret) right before opening the edit dialog.
  const openEdit = () => {
    startTransition(async () => {
      try {
        const config = await queryClient.fetchQuery(
          sourcesQueries.config(source.id),
        );
        setEditValues({ ...config, secretAccessKey: "" });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Couldn't load this source.",
        );
      }
    });
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
    <>
      <Dialog
        open={editValues !== null}
        onOpenChange={(open) => {
          if (!open) setEditValues(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {source.name}</DialogTitle>
            <DialogDescription>
              The connection is verified again when you save.
            </DialogDescription>
          </DialogHeader>
          {editValues ? (
            <SourceForm
              edit={{ sourceId: source.id, initialValues: editValues }}
              onSuccess={() => setEditValues(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Remove ${source.name}?`}
        description="This only removes the source from Bucket UI — nothing in your bucket is touched."
        confirmLabel="Remove"
        pendingLabel="Removing…"
        pending={pending}
        onConfirm={handleRemove}
      />
    </>
  );

  return { openEdit, requestRemove, pending, dialogs };
}
