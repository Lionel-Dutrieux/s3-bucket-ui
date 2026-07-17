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
  const t = useTranslations("browser.copyToDialog");
  const tFolder = useTranslations("browser.folderPicker");
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
    if (failed > 0) {
      toast.warning(t("copyPartialFailedToast", { copied, skipped, failed }));
    } else {
      toast.success(t("copiedToast", { copied, skipped, name: dest.name }));
    }
    onCopied();
  };

  return (
    <DestinationDialog
      open={open}
      onOpenChange={onOpenChange}
      pending={pending}
      title={t("title", { count })}
      description={t("description")}
      destinationLabel={dest ? `→ ${dest.name}:/${destPrefix}` : ""}
      submitLabel={t("copyHere")}
      pendingLabel={t("copying")}
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
    </DestinationDialog>
  );
}
