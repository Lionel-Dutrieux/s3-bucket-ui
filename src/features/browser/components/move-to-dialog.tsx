"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moveEntries, moveEntriesToSource } from "@/features/browser/actions";
import { browserQueries } from "@/features/browser/api/queries";
import { DestinationDialog } from "@/features/browser/components/destination-dialog";
import { FolderPicker } from "@/features/browser/components/folder-picker";
import { usePendingAction } from "@/features/browser/hooks/use-pending-action";
import { type EntryTarget, planMove } from "@/features/browser/lib/move";

/**
 * "Move to…" with a destination picker. Defaults to the current source (a
 * plain within-source move, native copy+delete with the all-or-nothing
 * conflict check); pick another source to move across — copy through this
 * process, then delete the copied objects from the origin.
 */
export function MoveToDialog({
  sourceId,
  targets,
  onOpenChange,
  onMoved,
}: {
  sourceId: string;
  /** Selection to move — the dialog is open while non-null. */
  targets: EntryTarget[] | null;
  onOpenChange: (open: boolean) => void;
  onMoved: () => void;
}) {
  const t = useTranslations("browser.moveToDialog");
  const tFolder = useTranslations("browser.folderPicker");
  const tErrors = useTranslations("browser.errors");
  const open = targets !== null;
  const [destSourceId, setDestSourceId] = useState("");
  const [destPrefix, setDestPrefix] = useState("");
  const { pending, track } = usePendingAction();

  // Fresh start each time the dialog opens — default to the current source.
  useEffect(() => {
    if (open) {
      setDestSourceId(sourceId);
      setDestPrefix("");
    }
  }, [open, sourceId]);

  const sources = useQuery({
    ...browserQueries.writableSources(),
    enabled: open,
  });
  const dest = sources.data?.find((source) => source.id === destSourceId);
  const isSameSource = destSourceId === sourceId;
  const count = targets?.length ?? 0;

  // Self/descendant guard only makes sense within the same source.
  const plan = targets && isSameSource ? planMove(targets, destPrefix) : null;
  const intraMoveCount = plan && !plan.error ? plan.moves.length : 0;

  const submitDisabled =
    !destSourceId ||
    (isSameSource ? !!plan?.error || intraMoveCount === 0 : false);

  const run = async () => {
    if (!targets || !destSourceId) return;

    if (isSameSource) {
      if (!plan || plan.error || intraMoveCount === 0) return;
      const result = await track(() =>
        moveEntries(sourceId, targets, destPrefix),
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("movedToast", { count: intraMoveCount }));
      onMoved();
      return;
    }

    const result = await track(() =>
      moveEntriesToSource(sourceId, destSourceId, targets, destPrefix),
    );
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { moved, skipped, failed } = result.data;
    if (failed > 0) {
      toast.warning(t("movePartialFailedToast", { moved, skipped, failed }));
    } else {
      toast.success(
        t("movedAcrossToast", { moved, skipped, name: dest?.name ?? "" }),
      );
    }
    onMoved();
  };

  return (
    <DestinationDialog
      open={open}
      onOpenChange={onOpenChange}
      pending={pending}
      title={t("title", { count })}
      description={t("description")}
      destinationLabel={dest ? `→ ${dest.name}:/${destPrefix}` : ""}
      submitLabel={t("moveHere")}
      pendingLabel={t("moving")}
      submitDisabled={submitDisabled}
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
        <SelectTrigger
          className="w-full"
          aria-label={t("destinationSourceAria")}
        >
          <SelectValue
            placeholder={
              sources.isPending ? t("loadingSources") : t("chooseSource")
            }
          />
        </SelectTrigger>
        <SelectContent>
          {sources.data?.map((source) => (
            <SelectItem key={source.id} value={source.id}>
              {source.name}
              {source.id === sourceId ? (
                <span className="text-xs text-muted-foreground">
                  {t("thisSource")}
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
          {t("noWritableSources")}
        </p>
      ) : null}

      {destSourceId ? (
        <FolderPicker
          sourceId={destSourceId}
          rootLabel={dest?.name ?? tFolder("root")}
          prefix={destPrefix}
          onPrefixChange={setDestPrefix}
          disabled={pending}
        />
      ) : null}

      {plan?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors("selfMove")}
        </p>
      ) : null}
    </DestinationDialog>
  );
}
