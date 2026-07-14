"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { useQueryClient } from "@tanstack/react-query";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowLeft, FolderOpen, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  deleteEntries,
  deleteFolder,
  deleteObject,
} from "@/features/browser/actions";
import { downloadUrl } from "@/features/browser/api/client";
import { browserQueries } from "@/features/browser/api/queries";
import {
  browserColumns,
  selectColumn,
} from "@/features/browser/components/browser-columns";
import { BrowserToolbar } from "@/features/browser/components/browser-toolbar";
import { DetailsDialog } from "@/features/browser/components/details-dialog";
import {
  type DragData,
  DragPreview,
  type DropData,
  ParentDropZone,
} from "@/features/browser/components/dnd";
import { DropOverlay } from "@/features/browser/components/drop-overlay";
import { FileGrid } from "@/features/browser/components/file-grid";
import { FileTable } from "@/features/browser/components/file-table";
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
import { SelectionToolbar } from "@/features/browser/components/selection-toolbar";
import { UploadTray } from "@/features/browser/components/upload-tray";
import { useDropUpload } from "@/features/browser/hooks/use-drop-upload";
import { useUploads } from "@/features/browser/hooks/use-uploads";
import {
  type BrowserEntry,
  buildEntries,
  entryMatches,
} from "@/features/browser/lib/entries";
import type { FileEntry, FolderEntry } from "@/features/browser/lib/listing";
import {
  type EntryTarget,
  folderName,
  planMove,
} from "@/features/browser/lib/move";
import { sortParser } from "@/features/browser/lib/sort-param";
import type { ViewMode } from "@/features/browser/lib/view";
import { parentPrefix as parentPrefixOf } from "@/lib/paths";

export interface BrowserPermissions {
  upload: boolean;
  delete: boolean;
}

/** Folder/file union → the shape the move actions take. */
function toTarget(entry: BrowserEntry): EntryTarget {
  return entry.kind === "folder"
    ? { kind: "folder", prefix: entry.prefix }
    : { kind: "file", key: entry.key };
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
  const queryClient = useQueryClient();
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

  // A selection belongs to one folder — navigating away discards it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the reset is intentionally keyed on the folder change
  useEffect(() => {
    setRowSelection({});
  }, [prefix]);

  const refresh = useCallback(() => router.refresh(), [router]);
  const uploads = useUploads(sourceId, prefix, refresh);
  const { dragging, dropZoneProps } = useDropUpload(
    permissions.upload,
    uploads.addFiles,
  );
  // Renaming and moving keep the content (copy + delete of the old key under
  // the hood) — they're edits, gated on the edit capability alone.
  const canRename = permissions.upload;
  const canMove = permissions.upload;
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
    try {
      // fetchQuery (not a bare fetch) dedupes rapid double-clicks; the default
      // staleTime of 0 still mints a fresh link on each later copy.
      const url = await queryClient.fetchQuery(
        browserQueries.shareUrl(sourceId, file.key),
      );
      await navigator.clipboard.writeText(url);
      toast.success("Link copied — valid for 1 hour");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create a link.",
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result =
      deleteTarget.kind === "folder"
        ? await deleteFolder(sourceId, deleteTarget.prefix)
        : await deleteObject(sourceId, deleteTarget.key);
    setDeleting(false);
    if (!result.ok) {
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
  const parentPrefix = parentPrefixOf(prefix);

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
        anchor.href = downloadUrl(sourceId, file.key);
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
    const targets = selectedRows.map((row) => toTarget(row.original));
    setDeleting(true);
    const result = await deleteEntries(sourceId, targets);
    setDeleting(false);
    setBulkConfirmOpen(false);
    setRowSelection({});
    // Partial failures still deleted some objects — refresh either way.
    router.refresh();
    if (!result.ok) {
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

  // The moving set: the whole selection if the dragged row is part of it,
  // otherwise just the dragged row.
  const movingTargets = (dragged: DragData): EntryTarget[] => {
    const selectedIds = new Set(Object.keys(rowSelection));
    if (selectedIds.size > 1 && selectedIds.has(dragged.rowId)) {
      return selectedRows.map((row) => toTarget(row.original));
    }
    return [dragged.target];
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
    <div
      className="relative min-h-[calc(100dvh-6rem)] space-y-3"
      {...dropZoneProps}
    >
      {selectedCount > 0 ? (
        <SelectionToolbar
          selectedCount={selectedCount}
          allVisibleSelected={allVisibleSelected}
          onClear={() => setRowSelection({})}
          onToggleSelectAll={toggleSelectAll}
          onBulkDownload={handleBulkDownload}
          bulkDownloadDisabled={selectedFiles.length === 0}
          canDelete={permissions.delete}
          onBulkDelete={() => setBulkConfirmOpen(true)}
        />
      ) : (
        <BrowserToolbar
          hasEntries={entries.length > 0}
          query={query}
          matchCount={rows.length}
          onQueryChange={(value) => table.setGlobalFilter(value)}
          view={view}
          sorting={sorting}
          onSortingChange={handleSortingChange}
          canUpload={permissions.upload}
          onNewFolder={() => setNewFolderOpen(true)}
          onUploadFiles={uploads.addFiles}
        />
      )}

      {noMatches ? (
        <EmptyState
          icon={SearchX}
          title="No matches"
          description={
            <>Nothing in this folder matches &ldquo;{query}&rdquo;.</>
          }
        >
          <Button
            variant="outline"
            size="sm"
            className="mt-1"
            onClick={() => table.setGlobalFilter("")}
          >
            Clear filter
          </Button>
        </EmptyState>
      ) : entries.length === 0 ? (
        <EmptyFolder
          sourceId={sourceId}
          prefix={prefix}
          canUpload={permissions.upload}
        />
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

      {dragging ? <DropOverlay /> : null}

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

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        title={`Delete ${deleteTarget?.name}?`}
        titleClassName="break-all"
        description={
          deleteTarget?.kind === "folder"
            ? "This permanently deletes the folder and everything inside it from the bucket. There is no undo."
            : "This permanently deletes the object from the bucket. There is no undo."
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending={deleting}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={(open) => {
          if (!deleting) setBulkConfirmOpen(open);
        }}
        title={`Delete ${selectedCount} item${selectedCount === 1 ? "" : "s"}?`}
        description="This permanently deletes the selection from the bucket — folders with everything inside them. There is no undo."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending={deleting}
        onConfirm={handleBulkDelete}
      />

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

function EmptyFolder({
  sourceId,
  prefix,
  canUpload,
}: {
  sourceId: string;
  prefix: string;
  canUpload: boolean;
}) {
  // At the bucket root there is no parent to go back to.
  const parent = prefix ? (parentPrefixOf(prefix) ?? "") : null;

  return (
    <EmptyState
      icon={FolderOpen}
      title="This folder is empty"
      description={
        canUpload
          ? "Drop files here, or use Upload to add some."
          : "Files uploaded to this location will show up here."
      }
    >
      {parent !== null ? (
        <Button variant="outline" size="sm" className="mt-1" asChild>
          <Link
            href={{
              pathname: `/source/${sourceId}`,
              query: parent ? { prefix: parent } : undefined,
            }}
          >
            <ArrowLeft aria-hidden />
            Back to parent folder
          </Link>
        </Button>
      ) : null}
    </EmptyState>
  );
}
