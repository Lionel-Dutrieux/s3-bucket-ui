"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Folder, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
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
import { copyEntriesToSource } from "@/features/browser/actions";
import { browserQueries } from "@/features/browser/api/queries";
import { buildCrumbs } from "@/features/browser/lib/listing";
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
  const [pending, setPending] = useState(false);

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
  const folders = useQuery({
    ...browserQueries.folders(destSourceId, destPrefix),
    enabled: open && destSourceId !== "",
  });

  const dest = sources.data?.find((source) => source.id === destSourceId);
  const count = targets?.length ?? 0;

  const run = async () => {
    if (!targets || !dest) return;
    setPending(true);
    const result = await copyEntriesToSource(
      sourceId,
      dest.id,
      targets,
      destPrefix,
    );
    setPending(false);
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Copy {count} item{count === 1 ? "" : "s"} to…
          </DialogTitle>
          <DialogDescription>
            Pick a source and a folder. Objects already present in the
            destination are skipped; nothing is removed from here.
          </DialogDescription>
        </DialogHeader>

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
                  <span className="font-mono text-xs text-muted-foreground">
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
          <div className="overflow-hidden rounded-lg border">
            {/* Path bar: every ancestor is one click away. */}
            <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-2 py-1.5 text-sm">
              <button
                type="button"
                onClick={() => setDestPrefix("")}
                disabled={pending}
                className={
                  destPrefix === ""
                    ? "rounded px-1 font-medium"
                    : "rounded px-1 text-muted-foreground hover:text-foreground"
                }
              >
                {dest?.name ?? "Root"}
              </button>
              {buildCrumbs(destPrefix).map((crumb, index, crumbs) => (
                <span key={crumb.prefix} className="flex items-center gap-0.5">
                  <ChevronRight
                    className="size-3.5 text-muted-foreground"
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => setDestPrefix(crumb.prefix)}
                    disabled={pending}
                    className={
                      index === crumbs.length - 1
                        ? "rounded px-1 font-medium"
                        : "rounded px-1 text-muted-foreground hover:text-foreground"
                    }
                  >
                    {crumb.label}
                  </button>
                </span>
              ))}
            </div>

            <div className="max-h-52 overflow-y-auto">
              {folders.isPending ? (
                <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                  Loading folders…
                </p>
              ) : folders.isError ? (
                <p role="alert" className="px-3 py-4 text-sm text-destructive">
                  {folders.error instanceof Error
                    ? folders.error.message
                    : "Could not list this folder."}
                </p>
              ) : folders.data.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  No subfolders — the selection lands right here.
                </p>
              ) : (
                <ul className="divide-y">
                  {folders.data.map((folder) => (
                    <li key={folder.prefix}>
                      <button
                        type="button"
                        onClick={() => setDestPrefix(folder.prefix)}
                        disabled={pending}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      >
                        <Folder
                          className="size-4 shrink-0 fill-amber-400/80 text-primary"
                          aria-hidden
                        />
                        <span className="truncate">{folder.name}</span>
                        <ChevronRight
                          className="ml-auto size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
            {dest ? `→ ${dest.name}:/${destPrefix}` : ""}
          </span>
          <Button onClick={run} disabled={pending || !dest}>
            {pending ? (
              <>
                <Loader2Icon className="animate-spin" aria-hidden />
                Copying…
              </>
            ) : (
              "Copy here"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
