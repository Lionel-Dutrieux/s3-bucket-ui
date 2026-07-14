"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSourceActions } from "@/features/sources/hooks/use-source-actions";
import type { SourceSummary } from "@/lib/dal/sources";

/** Edit/Remove buttons for a source card in the admin area. */
export function SourceCardActions({ source }: { source: SourceSummary }) {
  const { openEdit, requestRemove, pending, dialogs } =
    useSourceActions(source);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="outline" size="sm" disabled={pending} onClick={openEdit}>
        <Pencil aria-hidden />
        Edit
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        disabled={pending}
        onClick={requestRemove}
        aria-label={`Remove ${source.name}`}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
      {dialogs}
    </div>
  );
}
