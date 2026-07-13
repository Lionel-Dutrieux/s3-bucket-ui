"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { renameFolder, renameObject } from "@/features/browser/write-actions";
import type { BrowserEntry } from "@/features/browser/entries";
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
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  // Seed the field with the current name whenever a new entry opens.
  useEffect(() => {
    if (entry) setName(entry.name);
  }, [entry]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entry) return;
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === entry.name) {
      onOpenChange(false);
      return;
    }
    setPending(true);
    const result =
      entry.kind === "folder"
        ? await renameFolder(sourceId, entry.prefix, trimmed)
        : await renameObject(sourceId, entry.key, trimmed);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Renamed to ${trimmed}`);
    onOpenChange(false);
    onRenamed();
  };

  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-name">Name</Label>
            <Input
              id="rename-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              spellCheck={false}
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                pending || name.trim() === "" || name.trim() === entry?.name
              }
            >
              {pending ? "Renaming…" : "Rename"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
