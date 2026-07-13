"use client";

import { useStore } from "@tanstack/react-form";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { renameFolder, renameObject } from "@/features/browser/actions";
import type { BrowserEntry } from "@/features/browser/lib/entries";
import { entryNameSchema } from "@/features/browser/lib/schemas";
import { useAppForm } from "@/forms/form";

const renameSchema = z.object({ name: entryNameSchema });

export function RenameDialog({
  sourceId,
  entry,
  onOpenChange,
  onRenamed,
}: {
  sourceId: string;
  entry: BrowserEntry | null;
  onOpenChange: (open: boolean) => void;
  onRenamed: () => void;
}) {
  const form = useAppForm({
    defaultValues: { name: entry?.name ?? "" },
    validators: {
      // Same schema as the server actions — errors map onto the field.
      onChange: renameSchema,
    },
    onSubmit: async ({ value }) => {
      if (!entry) return;
      const trimmed = value.name.trim();
      // Unchanged name: close silently, nothing to do.
      if (trimmed === entry.name) {
        onOpenChange(false);
        return;
      }
      const result =
        entry.kind === "folder"
          ? await renameFolder(sourceId, entry.prefix, trimmed)
          : await renameObject(sourceId, entry.key, trimmed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Renamed to ${trimmed}`);
      onOpenChange(false);
      onRenamed();
    },
  });
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  // Seed the field with the current name whenever a new entry opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is keyed on the entry changing
  useEffect(() => {
    if (entry) form.reset({ name: entry.name });
  }, [entry]);

  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Rename {entry?.kind === "folder" ? "folder" : "file"}
          </DialogTitle>
          <DialogDescription>
            {entry?.kind === "folder"
              ? "Every object inside the folder moves to the new name."
              : "The file keeps its place in this folder."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.AppField name="name">
            {(field) => <field.TextField label="Name" autoFocus />}
          </form.AppField>
          <DialogFooter>
            <form.Subscribe selector={(state) => state.values.name}>
              {(name) => (
                <form.AppForm>
                  <form.SubmitButton
                    pendingLabel="Renaming…"
                    disabled={name.trim() === "" || name.trim() === entry?.name}
                  >
                    Rename
                  </form.SubmitButton>
                </form.AppForm>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
