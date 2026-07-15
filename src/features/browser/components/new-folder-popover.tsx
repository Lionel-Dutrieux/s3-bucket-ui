"use client";

import { useStore } from "@tanstack/react-form";
import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createFolder } from "@/features/browser/actions";
import { folderNameSchema } from "@/features/browser/lib/schemas";
import { useAppForm } from "@/forms/form";

const newFolderSchema = z.object({ name: folderNameSchema });

/** One field, one button — a popover anchored on the trigger, not a modal. */
export function NewFolderPopover({
  sourceId,
  prefix,
  onCreated,
}: {
  sourceId: string;
  prefix: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      onCreated();
    },
  });
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) {
          if (!next) form.reset();
          setOpen(next);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          <FolderPlus aria-hidden />
          New folder
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-3"
        >
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label="New folder"
                placeholder="Invoices"
                autoFocus
              />
            )}
          </form.AppField>
          <form.Subscribe selector={(state) => state.values.name}>
            {(name) => (
              <form.AppForm>
                <form.SubmitButton
                  pendingLabel="Creating…"
                  disabled={name.trim() === ""}
                  className="w-full"
                >
                  Create folder
                </form.SubmitButton>
              </form.AppForm>
            )}
          </form.Subscribe>
        </form>
      </PopoverContent>
    </Popover>
  );
}
