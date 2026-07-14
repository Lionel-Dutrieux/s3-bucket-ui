"use client";

import { ArrowRight, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copySourceContents } from "@/features/sources/actions";
import { providerIcon } from "@/features/sources/components/provider-icons";
import type { SourceSummary } from "@/lib/dal/sources";

/**
 * Copies a source's entire contents into another source — cross-provider
 * (the server streams each object between the two). Non-destructive by
 * design: existing destination keys are skipped, the origin is untouched.
 */
export function MigrateSourceDialog({
  source,
  destinations,
  open,
  onOpenChange,
}: {
  source: SourceSummary;
  destinations: SourceSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [destId, setDestId] = useState<string>("");
  const [pending, setPending] = useState(false);
  const dest = destinations.find((candidate) => candidate.id === destId);

  const run = async () => {
    if (!dest) return;
    setPending(true);
    const result = await copySourceContents(source.id, dest.id);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { transferred, skipped, failed } = result.data;
    const summary = `${transferred} object${transferred === 1 ? "" : "s"} copied${
      skipped ? `, ${skipped} skipped` : ""
    }`;
    if (failed > 0) {
      toast.warning(`${summary}, ${failed} failed — run it again to retry.`);
    } else {
      toast.success(`${summary} to ${dest.name}`);
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy contents to another source</DialogTitle>
          <DialogDescription>
            Every object in{" "}
            <span className="font-medium text-foreground">{source.name}</span>{" "}
            is copied into the destination — across providers if needed. Objects
            already present there are skipped, and nothing is removed from this
            source.
          </DialogDescription>
        </DialogHeader>

        <Select value={destId} onValueChange={setDestId} disabled={pending}>
          <SelectTrigger className="w-full" aria-label="Destination source">
            <SelectValue placeholder="Choose a destination…" />
          </SelectTrigger>
          <SelectContent>
            {destinations.map((candidate) => {
              const Icon = providerIcon(candidate.provider);
              return (
                <SelectItem key={candidate.id} value={candidate.id}>
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  {candidate.name}
                  <span className="font-mono text-xs text-muted-foreground">
                    {candidate.bucket}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {pending ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Copying — large sources can take a while, keep this page open.
          </p>
        ) : null}

        <DialogFooter>
          <Button onClick={run} disabled={pending || !dest}>
            {pending ? (
              "Copying…"
            ) : (
              <>
                Copy everything
                <ArrowRight aria-hidden />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
