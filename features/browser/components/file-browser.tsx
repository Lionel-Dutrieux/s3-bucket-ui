"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import {
  Download,
  FolderOpen,
  FolderPlus,
  Search,
  SearchX,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getShareUrl } from "@/features/browser/read-actions";
import {
  deleteEntries,
  deleteFolder,
  deleteObject,
} from "@/features/browser/write-actions";
import {
  browserColumns,
  downloadHref,
  selectColumn,
} from "@/features/browser/components/browser-columns";
import { DetailsDialog } from "@/features/browser/components/details-dialog";
import {
  DragPreview,
  ParentDropZone,
  type DragData,
  type DropData,
} from "@/features/browser/components/dnd";
import { FileGrid } from "@/features/browser/components/file-grid";
import { FileTable } from "@/features/browser/components/file-table";
import { GridSortMenu } from "@/features/browser/components/grid-sort-menu";
import {
  MoveDialog,
  type MoveRequest,
} from "@/features/browser/components/move-dialog";
import { NewFolderDialog } from "@/features/browser/components/new-folder-dialog";
import {
  isPreviewable,
  PreviewDialog,
} from "@/features/browser/components/preview-dialog";
import { RenameDialog } from "@/features/browser/components/rename-dialog";
import { UploadTray } from "@/features/browser/components/upload-tray";
import { filesFromDataTransfer } from "@/features/browser/drop";
import {
  buildEntries,
  entryMatches,
  type BrowserEntry,
} from "@/features/browser/entries";
import type { FileEntry, FolderEntry } from "@/features/browser/listing";
import {
  folderName,
  planMove,
  type EntryTarget as MoveTarget,
} from "@/features/browser/move";
import { sortParser } from "@/features/browser/sort-param";
import { useUploads } from "@/features/browser/use-uploads";
import type { ViewMode } from "@/features/browser/view";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface BrowserPermissions {
  upload: boolean;
  delete: boolean;
}

/**
 * Client shell around the listing: one TanStack Table instance filters and
 * sorts the entries the server already loaded (this page only). The list view
 * renders the table; the grid view consumes the same row model, so search and
 * sort apply to both. Filter and sort live in the URL (?q=, ?sort=) so a
 * refresh or a shared link keeps them. Also owns the preview, details and
 * delete dialogs plus the upload queue — write controls only render when the
 * source's permissions allow them (the server re-checks every call).
 */
export function FileBrowser({
  sourceId,
  prefix,
  folders,
  files,
  view,
  permissions,
}: {
  sourceId: string;
  prefix: string;
  folders: FolderEntry[];
  files: FileEntry[];
  view: ViewMode;
  permissions: BrowserPermissions;
}) {
  const router = useRouter();
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [sorting, setSorting] = useQueryState(
    "sort",
    sortParser.withDefault([]),
  );
  const [preview, setPreview] = useState<FileEntry | null>(null);
  const [details, setDetails] = useState<FileEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BrowserEntry | null>(null);
  const [renameTarget, setRenameTarget] = useState<BrowserEntry | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  // A selection belongs to one folder — navigating away discards it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the reset is intentionally keyed on the folder change
  useEffect(() => {
    setRowSelection({});
  }, [prefix]);
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => router.refresh(), [router]);
  const uploads = useUploads(sourceId, prefix, refresh);
  // Rename writes the new object and deletes the old one, so it needs both.
  const canRename = permissions.upload && permissions.delete;
  // Moving needs both too — a move is a copy + delete under the hood.
  const canMove = permissions.upload && permissions.delete;
  const [activeDrag, setActiveDrag] = useState<{
    label: string;
    count: number;
    kind: "file" | "folder";
  } | null>(null);
  const [moveRequest, setMoveRequest] = useState<MoveRequest | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((prev) =>
      typeof updater === "function" ? updater(prev) : updater,
    );
  };

  const handleCopyLink = async (file: FileEntry) => {
    const result = await getShareUrl(sourceId, file.key);
    if (!result.url) {
      toast.error(result.error ?? "Could not create a link.");
      return;
    }
    await navigator.clipboard.writeText(result.url);
    toast.success("Link copied — valid for 1 hour");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result =
      deleteTarget.kind === "folder"
        ? await deleteFolder(sourceId, deleteTarget.prefix)
        : await deleteObject(sourceId, deleteTarget.key);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Deleted ${deleteTarget.name}`);
    setDeleteTarget(null);
    router.refresh();
  };

  const entries = useMemo(() => buildEntries(folders, files), [folders, files]);
  // Selection serves bulk download too, so it's on regardless of
  // permissions — only the bulk Delete button is permission-gated.
  const columns = useMemo(() => [selectColumn, ...browserColumns], []);

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting, globalFilter: query, rowSelection },
    onSortingChange: handleSortingChange,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    // Stable ids (folder prefix / file key) instead of indexes, so a
    // selection can never silently shift onto another row.
    getRowId: (entry) => (entry.kind === "folder" ? entry.prefix : entry.key),
    onGlobalFilterChange: (updater) =>
      setQuery((prev) =>
        String(typeof updater === "function" ? updater(prev) : (updater ?? "")),
      ),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, value) =>
      entryMatches(row.original, String(value)),
    sortDescFirst: false,
    enableMultiSort: false,
    meta: {
      sourceId,
      onPreview: setPreview,
      onCopyLink: handleCopyLink,
      onDetails: setDetails,
      onDelete: permissions.delete ? setDeleteTarget : undefined,
      // Rename moves the object (write + delete), so it needs both.
      onRename: canRename ? setRenameTarget : undefined,
    },
  });

  const rows = table.getRowModel().rows;
  const noMatches = query !== "" && rows.length === 0;
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  // Acts on the visible (filtered) rows, so it never selects rows a name
  // filter is hiding — same rule as the list header checkbox.
  const allVisibleSelected =
    rows.length > 0 && rows.every((row) => row.getIsSelected());
  const toggleSelectAll = () =>
    setRowSelection(
      allVisibleSelected
        ? {}
        : Object.fromEntries(rows.map((row) => [row.id, true])),
    );

  // The "move to parent folder" drop zone's destination — null at the root.
  const parentPrefix =
    prefix === ""
      ? null
      : (() => {
          const segments = prefix.split("/").filter(Boolean);
          return segments.length > 1
            ? `${segments.slice(0, -1).join("/")}/`
            : "";
        })();

  const gridSelection = {
    isSelected: (id: string) => rowSelection[id] === true,
    toggle: (id: string) =>
      setRowSelection((prev) => {
        const next = { ...prev };
        if (next[id]) {
          delete next[id];
        } else {
          next[id] = true;
        }
        return next;
      }),
    active: selectedCount > 0,
  };

  const selectedFiles = selectedRows
    .map((row) => row.original)
    .filter((entry) => entry.kind === "file");

  // One browser download per selected file, staggered so none get dropped
  // (Chrome asks once to allow multiple downloads). Folders would need a
  // server-side zip — out of scope, they're skipped with a note.
  const handleBulkDownload = () => {
    const skippedFolders = selectedCount - selectedFiles.length;
    selectedFiles.forEach((file, index) => {
      setTimeout(() => {
        const anchor = document.createElement("a");
        anchor.href = downloadHref(sourceId, file.key);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }, index * 300);
    });
    if (skippedFolders > 0) {
      toast.info(
        `${skippedFolders} folder${skippedFolders === 1 ? "" : "s"} skipped — only files can be downloaded.`,
      );
    }
  };

  const handleBulkDelete = async () => {
    const targets: MoveTarget[] = selectedRows.map((row) =>
      row.original.kind === "folder"
        ? { kind: "folder", prefix: row.original.prefix }
        : { kind: "file", key: row.original.key },
    );
    setDeleting(true);
    const result = await deleteEntries(sourceId, targets);
    setDeleting(false);
    setBulkConfirmOpen(false);
    setRowSelection({});
    // Partial failures still deleted some objects — refresh either way.
    router.refresh();
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        `Deleted ${targets.length} item${targets.length === 1 ? "" : "s"}`,
      );
    }
  };
  // Previewable files in display order — the dialog's ←/→ walk this list.
  const previewFiles = rows
    .map((row) => row.original)
    .filter(
      (entry): entry is Extract<BrowserEntry, { kind: "file" }> =>
        entry.kind === "file" && isPreviewable(entry.name),
    );

  // dragenter/dragleave fire for every child the cursor crosses — a depth
  // counter keeps the overlay stable until the pointer truly leaves.
  const dropZoneProps = permissions.upload
    ? {
        onDragEnter: (event: React.DragEvent) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        },
        onDragOver: (event: React.DragEvent) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
          }
        },
        onDragLeave: () => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        },
        onDrop: (event: React.DragEvent) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          // Grabs the entry handles synchronously, then walks folders async.
          filesFromDataTransfer(event.dataTransfer).then((dropped) => {
            if (dropped.length > 0) uploads.addFiles(dropped);
          });
        },
      }
    : {};

  // The moving set: the whole selection if the dragged row is part of it,
  // otherwise just the dragged row.
  const movingTargets = (dragged: DragData): MoveTarget[] => {
    const selectedIds = new Set(Object.keys(rowSelection));
    const source =
      selectedIds.size > 1 && selectedIds.has(dragged.rowId)
        ? selectedRows.map((row) => row.original)
        : null;
    if (!source) return [dragged.target];
    return source.map((entry) =>
      entry.kind === "folder"
        ? { kind: "folder", prefix: entry.prefix }
        : { kind: "file", key: entry.key },
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (!data) return;
    const count = movingTargets(data).length;
    setActiveDrag({ label: data.label, count, kind: data.target.kind });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const data = event.active.data.current as DragData | undefined;
    const over = event.over?.data.current as DropData | undefined;
    if (!data || !over) return;
    const targets = movingTargets(data);
    const plan = planMove(targets, over.prefix);
    if (plan.error) {
      toast.error(plan.error);
      return;
    }
    if (plan.moves.length === 0) return; // no-op drop (already there / self)
    const destLabel =
      over.prefix === "" ? "the parent folder" : folderName(over.prefix);
    setMoveRequest({
      targets,
      destPrefix: over.prefix,
      destLabel,
      count: plan.moves.length,
    });
  };

  return (
    <div className="relative space-y-3" {...dropZoneProps}>
      {selectedCount > 0 ? (
        <div className="flex h-8 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setRowSelection({})}
            aria-label="Clear selection"
          >
            <X className="size-4" aria-hidden />
          </Button>
          <span className="text-sm font-medium tabular-nums">
            {selectedCount} selected
          </span>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {allVisibleSelected ? "Deselect all" : "Select all"}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleBulkDownload}
              disabled={selectedFiles.length === 0}
            >
              <Download aria-hidden />
              Download
            </Button>
            {permissions.delete ? (
              <Button
                variant="destructive"
                size="sm"
                className="h-8"
                onClick={() => setBulkConfirmOpen(true)}
              >
                <Trash2 aria-hidden />
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {entries.length > 0 ? (
            <>
              <div className="relative w-full max-w-xs">
                <Search
                  className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(event) =>
                    table.setGlobalFilter(event.target.value)
                  }
                  placeholder="Filter by name"
                  aria-label="Filter by name"
                  className="h-8 pl-8"
                />
              </div>
              {query ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {rows.length} match{rows.length === 1 ? "" : "es"}
                </span>
              ) : null}
            </>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {view === "grid" && entries.length > 0 ? (
              <GridSortMenu
                sorting={sorting}
                onSortingChange={handleSortingChange}
              />
            ) : null}
            {permissions.upload ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => setNewFolderOpen(true)}
                >
                  <FolderPlus aria-hidden />
                  New folder
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files?.length) {
                      uploads.addFiles(event.target.files);
                    }
                    event.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  className="h-8"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload aria-hidden />
                  Upload
                </Button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {noMatches ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <SearchX className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Nothing in this folder matches “{query}”.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setGlobalFilter("")}
          >
            Clear filter
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <EmptyFolder canUpload={permissions.upload} />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDrag(null)}
          // The parent drop zone only mounts mid-drag, so re-measure droppables
          // continuously to register it.
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
          {canMove && parentPrefix !== null && activeDrag ? (
            <ParentDropZone parentPrefix={parentPrefix} />
          ) : null}
          {view === "grid" ? (
            <FileGrid
              sourceId={sourceId}
              folders={rows
                .map((row) => row.original)
                .filter((entry) => entry.kind === "folder")}
              files={rows
                .map((row) => row.original)
                .filter((entry) => entry.kind === "file")}
              onPreview={setPreview}
              onCopyLink={handleCopyLink}
              onDetails={setDetails}
              onDelete={permissions.delete ? setDeleteTarget : undefined}
              onRename={canRename ? setRenameTarget : undefined}
              selection={gridSelection}
              canMove={canMove}
            />
          ) : (
            <FileTable table={table} canMove={canMove} />
          )}
          <DragOverlay modifiers={[snapCenterToCursor]}>
            {activeDrag ? (
              <DragPreview
                label={activeDrag.label}
                count={activeDrag.count}
                kind={activeDrag.kind}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5">
          <p className="rounded-md bg-background/90 px-3 py-1.5 text-sm font-medium shadow-sm">
            Drop files to upload to this folder
          </p>
        </div>
      ) : null}

      <PreviewDialog
        sourceId={sourceId}
        file={preview}
        files={previewFiles}
        onFileChange={setPreview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        onCopyLink={handleCopyLink}
      />
      <DetailsDialog
        sourceId={sourceId}
        file={details}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-all">
              Delete {deleteTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "folder"
                ? "This permanently deletes the folder and everything inside it from the bucket. There is no undo."
                : "This permanently deletes the object from the bucket. There is no undo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkConfirmOpen}
        onOpenChange={(open) => {
          if (!deleting) setBulkConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} item{selectedCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selection from the bucket — folders
              with everything inside them. There is no undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleBulkDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RenameDialog
        sourceId={sourceId}
        entry={renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        onRenamed={refresh}
      />

      <MoveDialog
        sourceId={sourceId}
        request={moveRequest}
        onOpenChange={(open) => {
          if (!open) setMoveRequest(null);
        }}
        onMoved={() => {
          setMoveRequest(null);
          setRowSelection({});
          router.refresh();
        }}
      />

      <NewFolderDialog
        sourceId={sourceId}
        prefix={prefix}
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        onCreated={refresh}
      />

      <UploadTray
        items={uploads.items}
        onCancel={uploads.cancel}
        onDismiss={uploads.dismiss}
      />
    </div>
  );
}

function EmptyFolder({ canUpload }: { canUpload: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <FolderOpen className="size-5" aria-hidden />
      </div>
      <h2 className="text-base font-semibold">This folder is empty</h2>
      <p className="text-sm text-muted-foreground">
        {canUpload
          ? "Drop files here, or use Upload to add some."
          : "Files uploaded to this location will show up here."}
      </p>
    </div>
  );
}
