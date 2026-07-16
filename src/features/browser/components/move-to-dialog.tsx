"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { moveEntries } from "@/features/browser/actions";
import { DestinationDialog } from "@/features/browser/components/destination-dialog";
import { FolderPicker } from "@/features/browser/components/folder-picker";
import { usePendingAction } from "@/features/browser/hooks/use-pending-action";
import { type EntryTarget, planMove } from "@/features/browser/lib/move";

/**
 * Explicit "Move to…" with a destination picker — the keyboard/mobile
 * counterpart of drag-and-drop, same folder browser as Copy to….
 */
export function MoveToDialog({
  sourceId,
  targets,
  onOpenChange,
  onMoved,
}: {
  sourceId: string;
  /** Selection to move — the dialog is open while non-null. */
  targets: EntryTarget[] | null;
  onOpenChange: (open: boolean) => void;
  onMoved: () => void;
}) {
  const open = targets !== null;
  const [destPrefix, setDestPrefix] = useState("");
  const { pending, track } = usePendingAction();

  // Fresh start each time the dialog opens.
  useEffect(() => {
    if (open) setDestPrefix("");
  }, [open]);

  const count = targets?.length ?? 0;
  // Same rules as a drop: no moving a folder into itself, no no-ops.
  const plan = targets ? planMove(targets, destPrefix) : null;
  const moveCount = plan && !plan.error ? plan.moves.length : 0;

  const run = async () => {
    if (!targets || !plan || plan.error || moveCount === 0) return;
    const result = await track(() =>
      moveEntries(sourceId, targets, destPrefix),
    );
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Moved ${moveCount} item${moveCount === 1 ? "" : "s"}`);
    onMoved();
  };

  return (
    <DestinationDialog
      open={open}
      onOpenChange={onOpenChange}
      pending={pending}
      title={`Move ${count} item${count === 1 ? "" : "s"} to…`}
      description="Moving copies each object to the destination and deletes the original. Folders move everything inside them."
      destinationLabel={`→ /${destPrefix}`}
      submitLabel="Move here"
      pendingLabel="Moving…"
      submitDisabled={!plan || !!plan.error || moveCount === 0}
      onSubmit={run}
    >
      <FolderPicker
        sourceId={sourceId}
        rootLabel="Root"
        prefix={destPrefix}
        onPrefixChange={setDestPrefix}
        disabled={pending}
      />

      {plan?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {plan.error}
        </p>
      ) : null}
    </DestinationDialog>
  );
}
