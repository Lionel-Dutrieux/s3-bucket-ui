"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { renameFolder, renameObject } from "@/features/browser/actions";
import type { BrowserEntry } from "@/features/browser/lib/entries";
import { entryNameSchema } from "@/features/browser/lib/schemas";
import { cn } from "@/lib/utils";

/**
 * In-place rename (Drive-style): Enter commits, Escape or clicking away
 * cancels. Replaces the name text right where it sits, so there is no
 * dialog to open for a one-field edit.
 */
export function InlineRenameInput({
  sourceId,
  entry,
  onEnd,
  className,
}: {
  sourceId: string;
  entry: BrowserEntry;
  /** Called once the edit ends; true when a rename actually happened. */
  onEnd: (renamed: boolean) => void;
  className?: string;
}) {
  const [name, setName] = useState(entry.name);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (pending) return;
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === entry.name) {
      onEnd(false);
      return;
    }
    const parsed = entryNameSchema.safeParse(trimmed);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid name");
      return;
    }
    setPending(true);
    const result =
      entry.kind === "folder"
        ? await renameFolder(sourceId, entry.prefix, trimmed)
        : await renameObject(sourceId, entry.key, trimmed);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Renamed to ${trimmed}`);
    onEnd(true);
  };

  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2", className)}>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          // The row/table must not react to keys typed into the field.
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onEnd(false);
          }
        }}
        onBlur={() => {
          if (!pending) onEnd(false);
        }}
        // The overlay link / drag sensor sit under the input.
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        // Preselect the base name so typing replaces it but the
        // extension survives — the Drive behaviour.
        ref={(input) => {
          if (!input || document.activeElement === input) return;
          input.focus();
          const dot = entry.kind === "file" ? entry.name.lastIndexOf(".") : -1;
          input.setSelectionRange(0, dot > 0 ? dot : entry.name.length);
        }}
        disabled={pending}
        aria-label={`New name for ${entry.name}`}
        className="h-7 w-full min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {pending ? (
        <Loader2
          className="size-4 shrink-0 animate-spin text-muted-foreground"
          aria-label="Renaming"
        />
      ) : null}
    </div>
  );
}
