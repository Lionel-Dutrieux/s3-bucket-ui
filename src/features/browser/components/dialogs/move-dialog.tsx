"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { moveEntries } from "@/features/browser/actions/transfer";
import { usePendingAction } from "@/features/browser/hooks/use-pending-action";
import type { EntryTarget } from "@/features/browser/lib/move";

export interface MoveRequest {
  targets: EntryTarget[];
  destPrefix: string;
  /** Human label for the destination — folder name, or "the parent folder". */
  destLabel: string;
  /** Number of items that will actually move (no-ops already dropped). */
  count: number;
}

export function MoveDialog({
  sourceId,
  request,
  onOpenChange,
  onMoved,
}: {
  sourceId: string;
  request: MoveRequest | null;
  onOpenChange: (open: boolean) => void;
  onMoved: () => void;
}) {
  const t = useTranslations("browser.moveDialog");
  const tCommon = useTranslations("common");
  const { pending, track } = usePendingAction();

  const handleMove = async () => {
    if (!request) return;
    const result = await track(() =>
      moveEntries({
        sourceId,
        targets: request.targets,
        destPrefix: request.destPrefix,
      }),
    );
    if (result.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success(t("movedToast", { count: request.count }));
    onOpenChange(false);
    onMoved();
  };

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-all">
            {t("title", {
              count: request?.count ?? 0,
              destLabel: request?.destLabel ?? "",
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {tCommon("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              handleMove();
            }}
            disabled={pending}
          >
            {pending ? t("moving") : t("move")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
