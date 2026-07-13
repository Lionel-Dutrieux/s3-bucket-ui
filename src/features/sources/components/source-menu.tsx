"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeSource } from "@/features/sources/actions";
import { fetchSourceConfig } from "@/features/sources/api/client";
import { SourceForm } from "@/features/sources/components/source-form";
import type { SourceFormValues } from "@/features/sources/lib/schema";
import type { SourceSummary } from "@/lib/dal/sources";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuAction } from "@/components/ui/sidebar";

export function SourceMenu({
  source,
  isActive,
}: {
  source: SourceSummary;
  isActive: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editValues, setEditValues] = useState<SourceFormValues | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const queryClient = useQueryClient();

  // The summary in the sidebar doesn't carry endpoint/keys — fetch the full
  // record (minus the secret) right before opening the edit dialog.
  const handleEdit = () => {
    startTransition(async () => {
      try {
        const config = await queryClient.fetchQuery({
          queryKey: ["source-config", source.id],
          queryFn: () => fetchSourceConfig(source.id),
        });
        setEditValues({ ...config, secretAccessKey: "" });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Couldn't load this source.",
        );
      }
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      await removeSource(source.id);
      setConfirmOpen(false);
      toast.success("Source removed");
      if (isActive) {
        router.push("/");
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover>
            <MoreHorizontal aria-hidden />
            <span className="sr-only">Source options</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onSelect={handleEdit}>
            <Pencil aria-hidden />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 aria-hidden />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={editValues !== null}
        onOpenChange={(open) => {
          if (!open) setEditValues(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {source.name}</DialogTitle>
            <DialogDescription>
              The connection is verified again when you save.
            </DialogDescription>
          </DialogHeader>
          {editValues ? (
            <SourceForm
              edit={{ sourceId: source.id, initialValues: editValues }}
              onSuccess={() => setEditValues(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {source.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This only removes the source from Bucket UI — nothing in your
              bucket is touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleRemove();
              }}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
