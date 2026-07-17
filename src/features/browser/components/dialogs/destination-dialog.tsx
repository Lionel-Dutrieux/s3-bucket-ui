"use client";

import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Shared shell for the "… to a folder" dialogs (Copy to…, Move to…): header,
 * a slot for the destination pickers, and a footer showing the destination
 * path next to the submit button. Closing is blocked while the action runs.
 */
export function DestinationDialog({
  open,
  onOpenChange,
  pending,
  title,
  description,
  destinationLabel,
  submitLabel,
  pendingLabel,
  submitDisabled,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  title: string;
  description: string;
  /** Mono footer text — "→ source:/prefix"; empty until a destination exists. */
  destinationLabel: string;
  submitLabel: string;
  pendingLabel: string;
  submitDisabled: boolean;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {children}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
            {destinationLabel}
          </span>
          <Button onClick={onSubmit} disabled={pending || submitDisabled}>
            {pending ? (
              <>
                <Loader2Icon className="animate-spin" aria-hidden />
                {pendingLabel}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
