"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copyEntriesToSource } from "@/features/browser/actions";
import { browserQueries } from "@/features/browser/api/queries";
import { DestinationDialog } from "@/features/browser/components/destination-dialog";
import { FolderPicker } from "@/features/browser/components/folder-picker";
import { usePendingAction } from "@/features/browser/hooks/use-pending-action";
import type { EntryTarget } from "@/features/browser/lib/move";

/**
 * Copies the current selection into a folder of any source the user can
 * write to — including this one. Two steps in one dialog: pick the
 * destination source, then walk its folders; the copy never overwrites
 * (existing keys are skipped) and never touches the origin.
 */
export function CopyToDialog({
  sourceId,
  targets,
  onOpenChange,
  onCopied,
}: {
  sourceId: string;
  /** Selection to copy — the dialog is open while non-null. */
  targets: EntryTarget[] | null;
  onOpenChange: (open: boolean) => void;
  onCopied: () => void;
}) {
  const open = targets !== null;
  const [destSourceId, setDestSourceId] = useState<string>("");
  const [destPrefix, setDestPrefix] = useState("");
  const { pending, track } = usePendingAction();

  // Fresh start each time the dialog opens.
  useEffect(() => {
    if (open) {
      setDestSourceId("");
      setDestPrefix("");
    }
  }, [open]);

  const sources = useQuery({
    ...browserQueries.writableSources(),
    enabled: open,
  });

  const dest = sources.data?.find((source) => source.id === destSourceId);
  const count = targets?.length ?? 0;

  const run = async () => {
    if (!targets || !dest) return;
    const result = await track(() =>
      copyEntriesToSource(sourceId, dest.id, targets, destPrefix),
    );
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { copied, skipped, failed } = result.data;
    const summary = `${copied} object${copied === 1 ? "" : "s"} copied${
      skipped ? `, ${skipped} skipped` : ""
    }`;
    if (failed > 0) {
      toast.warning(`${summary}, ${failed} failed — run it again to retry.`);
    } else {
      toast.success(`${summary} to ${dest.name}`);
    }
    onCopied();
  };

  return (
    <DestinationDialog
      open={open}
      onOpenChange={onOpenChange}
      pending={pending}
      title={`Copy ${count} item${count === 1 ? "" : "s"} to…`}
      description="Pick a source and a folder. Objects already present in the destination are skipped; nothing is removed from here."
      destinationLabel={dest ? `→ ${dest.name}:/${destPrefix}` : ""}
      submitLabel="Copy here"
      pendingLabel="Copying…"
      submitDisabled={!dest}
      onSubmit={run}
    >
      <Select
        value={destSourceId}
        onValueChange={(value) => {
          setDestSourceId(value);
          setDestPrefix("");
        }}
        disabled={pending || sources.isPending}
      >
        <SelectTrigger className="w-full" aria-label="Destination source">
          <SelectValue
            placeholder={
              sources.isPending ? "Loading sources…" : "Choose a source…"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {sources.data?.map((source) => (
            <SelectItem key={source.id} value={source.id}>
              {source.name}
              {source.id === sourceId ? (
                <span className="text-xs text-muted-foreground">
                  this source
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {source.bucket}
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {sources.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&rsquo;t have edit access on any source.
        </p>
      ) : null}

      {destSourceId ? (
        <FolderPicker
          sourceId={destSourceId}
          rootLabel={dest?.name ?? "Root"}
          prefix={destPrefix}
          onPrefixChange={setDestPrefix}
          disabled={pending}
        />
      ) : null}
    </DestinationDialog>
  );
}
