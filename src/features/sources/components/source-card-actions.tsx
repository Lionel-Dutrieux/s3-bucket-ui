"use client";

import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MigrateSourceDialog } from "@/features/sources/components/migrate-source-dialog";
import { SourceDialog } from "@/features/sources/components/source-dialog";
import { useSourceActions } from "@/features/sources/hooks/use-source-actions";
import type { SourceFormValues } from "@/features/sources/lib/schema";
import type { SourceSummary } from "@/lib/dal/sources";

/** Edit/Migrate/Remove buttons for a source card in the admin area. */
export function SourceCardActions({
  source,
  editValues,
  otherSources,
}: {
  source: SourceSummary;
  /** Current connection values (secret blank) — feeds the edit dialog. */
  editValues: SourceFormValues;
  /** Migration destinations — every source except this one. */
  otherSources: SourceSummary[];
}) {
  const { requestRemove, pending, dialogs } = useSourceActions(source);
  const [editOpen, setEditOpen] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => setEditOpen(true)}
      >
        <Pencil aria-hidden />
        Edit
      </Button>
      {otherSources.length > 0 ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          disabled={pending}
          onClick={() => setMigrateOpen(true)}
          aria-label={`Copy the contents of ${source.name} to another source`}
          title="Copy contents to another source"
        >
          <ArrowRightLeft className="size-4" aria-hidden />
        </Button>
      ) : null}
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
      <SourceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        edit={{ sourceId: source.id, initialValues: editValues }}
      />
      <MigrateSourceDialog
        source={source}
        destinations={otherSources}
        open={migrateOpen}
        onOpenChange={setMigrateOpen}
      />
    </div>
  );
}
