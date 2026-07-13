"use client";

import { useStore } from "@tanstack/react-form";
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
import { createFolder } from "@/features/browser/actions";
import { folderNameSchema } from "@/features/browser/lib/schemas";
import { useAppForm } from "@/forms/form";

const newFolderSchema = z.object({ name: folderNameSchema });

export function NewFolderDialog({
  sourceId,
  prefix,
  open,
  onOpenChange,
  onCreated,
}: {
  sourceId: string;
  prefix: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const form = useAppForm({
    defaultValues: { name: "" },
    validators: {
      // Same schema as the server action — errors map onto the field.
      onChange: newFolderSchema,
    },
    onSubmit: async ({ value }) => {
      const result = await createFolder(sourceId, prefix, value.name);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Created ${value.name.trim()}`);
      form.reset();
      onOpenChange(false);
      onCreated();
    },
  });
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) {
          if (!next) form.reset();
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>
            Created inside the current folder.
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
            {(field) => (
              <field.TextField label="Name" placeholder="Invoices" autoFocus />
            )}
          </form.AppField>
          <DialogFooter>
            <form.Subscribe selector={(state) => state.values.name}>
              {(name) => (
                <form.AppForm>
                  <form.SubmitButton
                    pendingLabel="Creating…"
                    disabled={name.trim() === ""}
                  >
                    Create folder
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
