"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { moveEntries } from "@/features/browser/actions";
import { FolderPicker } from "@/features/browser/components/folder-picker";
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
  const [pending, setPending] = useState(false);

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
    setPending(true);
    const result = await moveEntries(sourceId, targets, destPrefix);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Moved ${moveCount} item${moveCount === 1 ? "" : "s"}`);
    onMoved();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Move {count} item{count === 1 ? "" : "s"} to…
          </DialogTitle>
          <DialogDescription>
            Moving copies each object to the destination and deletes the
            original. Folders move everything inside them.
          </DialogDescription>
        </DialogHeader>

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

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
            → /{destPrefix}
          </span>
          <Button
            onClick={run}
            disabled={pending || !plan || !!plan.error || moveCount === 0}
          >
            {pending ? (
              <>
                <Loader2Icon className="animate-spin" aria-hidden />
                Moving…
              </>
            ) : (
              "Move here"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
