"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { moveEntries } from "@/features/browser/actions";
import type { EntryTarget } from "@/features/browser/lib/move";

export interface MoveRequest {
  targets: EntryTarget[];
  destPrefix: string;
  /** Human label for the destination — folder name, or "the parent folder". */
  destLabel: string;
  /** Number of items that will actually move (no-ops already dropped). */
  count: number;
}

export function MoveDialog({
  sourceId,
  request,
  onOpenChange,
  onMoved,
}: {
  sourceId: string;
  request: MoveRequest | null;
  onOpenChange: (open: boolean) => void;
  onMoved: () => void;
}) {
  const [pending, setPending] = useState(false);

  const handleMove = async () => {
    if (!request) return;
    setPending(true);
    const result = await moveEntries(
      sourceId,
      request.targets,
      request.destPrefix,
    );
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Moved ${request.count} item${request.count === 1 ? "" : "s"}`,
    );
    onOpenChange(false);
    onMoved();
  };

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-all">
            Move {request?.count} item{request?.count === 1 ? "" : "s"} into
            &ldquo;{request?.destLabel}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Moving copies each object to the destination and deletes the
            original. Folders move everything inside them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              handleMove();
            }}
            disabled={pending}
          >
            {pending ? "Moving…" : "Move"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
