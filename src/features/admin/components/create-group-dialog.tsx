"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createGroup } from "@/features/admin/actions";
import { createGroupSchema } from "@/features/admin/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";

export function CreateGroupDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
          <DialogDescription>
            Members share the group&rsquo;s source access. If the name exactly
            matches a value of your identity provider&rsquo;s groups claim,
            members are assigned automatically at sign-in.
          </DialogDescription>
        </DialogHeader>
        {open ? <CreateGroupForm onSuccess={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateGroupForm({ onSuccess }: { onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string>();
  const router = useRouter();

  const form = useAppForm({
    defaultValues: { name: "" },
    validators: { onChange: createGroupSchema },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const result = await createGroup(value.name);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      toast.success(`Group "${value.name.trim()}" created`);
      onSuccess();
      router.refresh();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.AppField name="name">
        {(field) => (
          <field.TextField label="Name" placeholder="developers" autoFocus />
        )}
      </form.AppField>

      <FormAlert error={serverError} />

      <DialogFooter>
        <form.AppForm>
          <form.SubmitButton pendingLabel="Creating…">
            Create group
          </form.SubmitButton>
        </form.AppForm>
      </DialogFooter>
    </form>
  );
}
