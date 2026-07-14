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
import { createUser } from "@/features/admin/actions";
import { createUserSchema } from "@/features/admin/lib/schema";
import { FormAlert } from "@/forms/components/form-alert";
import { useAppForm } from "@/forms/form";

export function CreateUserDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            The account is usable right away — share the password with its owner
            and grant them sources.
          </DialogDescription>
        </DialogHeader>
        {open ? <CreateUserForm onSuccess={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateUserForm({ onSuccess }: { onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string>();
  const router = useRouter();

  const form = useAppForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "user" as "user" | "admin",
    },
    validators: { onChange: createUserSchema },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      const result = await createUser(value);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      toast.success(`Account created for ${value.email}`);
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
          <field.TextField label="Name" placeholder="Ada Lovelace" autoFocus />
        )}
      </form.AppField>
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label="Email"
            type="email"
            placeholder="ada@example.com"
          />
        )}
      </form.AppField>
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label="Password"
            type="password"
            autoComplete="new-password"
          />
        )}
      </form.AppField>
      <form.AppField name="role">
        {(field) => (
          <field.SelectField
            label="Role"
            options={[
              { value: "user", label: "User — sees only granted sources" },
              { value: "admin", label: "Admin — full access" },
            ]}
          />
        )}
      </form.AppField>

      <FormAlert error={serverError} />

      <DialogFooter>
        <form.AppForm>
          <form.SubmitButton pendingLabel="Creating…">
            Create user
          </form.SubmitButton>
        </form.AppForm>
      </DialogFooter>
    </form>
  );
}
