"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createFolder } from "@/features/browser/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    const result = await createFolder(sourceId, prefix, name);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Created ${name.trim()}`);
    setName("");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          if (!next) setName("");
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-folder-name">Name</Label>
            <Input
              id="new-folder-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Invoices"
              autoFocus
              spellCheck={false}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || name.trim() === ""}>
              {pending ? "Creating…" : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
