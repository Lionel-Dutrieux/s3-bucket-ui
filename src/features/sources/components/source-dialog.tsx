"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProviderPicker } from "@/features/sources/components/provider-picker";
import { SourceForm } from "@/features/sources/components/source-form";
import type { SourceFormValues } from "@/features/sources/lib/schema";
import { getProvider } from "@/lib/storage/providers";
import { cn } from "@/lib/utils";

/**
 * Add/edit source in two steps: the provider wall (search + technology
 * cards), then the connection form. The dialog narrows when moving from the
 * wall to the form; the form stays mounted while re-picking a provider so
 * typed values survive a "Change".
 */
export function SourceDialog({
  open,
  onOpenChange,
  edit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits an existing source (opens on the form). */
  edit?: { sourceId: string; initialValues: SourceFormValues };
}) {
  const router = useRouter();
  const initialProvider = edit?.initialValues.provider ?? null;
  const [provider, setProvider] = useState<string | null>(initialProvider);
  const [picking, setPicking] = useState(!edit);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      // Reset for the next open — the form itself unmounts with the dialog.
      setProvider(initialProvider);
      setPicking(!edit);
    }
  };

  const showPicker = picking || provider === null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "transition-[max-width] duration-200",
          showPicker ? "sm:max-w-2xl" : "sm:max-w-xl",
        )}
      >
        <DialogHeader>
          {showPicker ? (
            <>
              <DialogTitle>
                {edit ? "Change provider" : "Add source"}
              </DialogTitle>
              <DialogDescription>
                Pick where your files live — connection details come next.
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle>
                {edit
                  ? `Edit ${edit.initialValues.name}`
                  : `Connect ${getProvider(provider)?.label ?? provider}`}
              </DialogTitle>
              <DialogDescription>
                {edit
                  ? "The connection is verified again when you save."
                  : "Credentials are encrypted before they are stored."}
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {showPicker ? (
          <ProviderPicker
            onSelect={(id) => {
              setProvider(id);
              setPicking(false);
            }}
          />
        ) : null}

        {provider !== null ? (
          <div className={showPicker ? "hidden" : undefined}>
            <SourceForm
              provider={provider}
              onChangeProvider={() => setPicking(true)}
              edit={edit}
              onSuccess={() => {
                handleOpenChange(false);
                router.refresh();
              }}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
