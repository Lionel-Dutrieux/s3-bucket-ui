"use client";

import { DndContext, DragOverlay, MeasuringStrategy } from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowLeft, FileSearch, FolderOpen, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { duplicateObject } from "@/features/browser/actions/entries";
import {
  createBrowserColumns,
  createSelectColumn,
} from "@/features/browser/components/browser-columns";
import { BrowserToolbar } from "@/features/browser/components/browser-toolbar";
import { BrowserDialogs } from "@/features/browser/components/dialogs/browser-dialogs";
import { DetailsPanel } from "@/features/browser/components/dialogs/details-panel";
import { DragPreview, ParentDropZone } from "@/features/browser/components/dnd";
import { DropOverlay } from "@/features/browser/components/drop-overlay";
import { FileGrid } from "@/features/browser/components/file-grid";
import { FileTable } from "@/features/browser/components/file-table";
import { SelectionToolbar } from "@/features/browser/components/selection-toolbar";
import { UploadTray } from "@/features/browser/components/upload-tray";
import { useBrowserDialogs } from "@/features/browser/hooks/use-browser-dialogs";
import { useBrowserDnd } from "@/features/browser/hooks/use-browser-dnd";
import { useBrowserShortcuts } from "@/features/browser/hooks/use-browser-shortcuts";
import { useBulkDownload } from "@/features/browser/hooks/use-bulk-download";
import { useEntryDeletion } from "@/features/browser/hooks/use-entry-deletion";
import { useEntrySelection } from "@/features/browser/hooks/use-entry-selection";
import { useUploads } from "@/features/browser/hooks/use-uploads";
import {
  type BrowserEntry,
  buildEntries,
  entryMatches,
} from "@/features/browser/lib/entries";
import type { FileEntry, FolderEntry } from "@/features/browser/lib/listing";
import { toTarget } from "@/features/browser/lib/move";
import { isPreviewable } from "@/features/browser/lib/preview-kind";
import { OPEN_SOURCE_SEARCH_EVENT } from "@/features/browser/lib/search-event";
import { sortParser } from "@/features/browser/lib/sort-param";
import type { ViewMode } from "@/features/browser/lib/view";
import { parentPrefix as parentPrefixOf } from "@/lib/paths";
import type { SharePolicy } from "@/lib/shares/policy";

export interface BrowserPermissions {
  upload: boolean;
  delete: boolean;
}

/**
 * Client shell around the listing: one TanStack Table instance filters and
 * sorts the entries the server already loaded (this page only). The list view
 * renders the table; the grid view consumes the same row model, so search and
 * sort apply to both. Filter and sort live in the URL (?q=, ?sort=) so a
 * refresh or a shared link keeps them. Selection, drag-and-drop, deletion, the
 * bulk download and the mutually-exclusive dialogs each live in their own hook;
 * write controls only render when the source's permissions allow them (the
 * server re-checks every call).
 */
export function FileBrowser({
  sourceId,
  prefix,
  folders,
  files,
  view,
  permissions,
  canShare = true,
  sharePolicy,
}: {
  sourceId: string;
  prefix: string;
  folders: FolderEntry[];
  files: FileEntry[];
  view: ViewMode;
  permissions: BrowserPermissions;
  /** False when the admin switched public share links off. */
  canShare?: boolean;
  /** Org-wide share constraints reflected in the share dialog. */
  sharePolicy?: SharePolicy;
}) {
  const router = useRouter();
  const t = useTranslations("browser.fileBrowser");
  const columnsT = useTranslations("browser.columns");
  const locale = useLocale();
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [sorting, setSorting] = useQueryState(
    "sort",
    sortParser.withDefault([]),
  );
  // The previewed file lives in the URL: refresh restores it, Back closes it,
  // and the address bar is a deep link to "look at this file".
  const [previewKey, setPreviewKey] = useQueryState(
    "preview",
    parseAsString.withOptions({ history: "push" }),
  );
  const preview = useMemo(
    () =>
      previewKey === null
        ? null
        : (files.find((file) => file.key === previewKey) ?? null),
    [files, previewKey],
  );
  const openPreview = useCallback(
    (file: FileEntry) => setPreviewKey(file.key),
    [setPreviewKey],
  );
  const [details, setDetails] = useState<FileEntry | null>(null);
  const [renameTarget, setRenameTarget] = useState<BrowserEntry | null>(null);
  const dialogs = useBrowserDialogs();
  const selection = useEntrySelection();
  const { rowSelection, setRowSelection } = selection;

  // The Ctrl/Cmd+K palette asks for the source-wide search through a window
  // event — it lives in the layout tree, not under this component.
  const { openSearch } = dialogs;
  useEffect(() => {
    window.addEventListener(OPEN_SOURCE_SEARCH_EVENT, openSearch);
    return () =>
      window.removeEventListener(OPEN_SOURCE_SEARCH_EVENT, openSearch);
  }, [openSearch]);

  // A selection belongs to one folder — navigating away discards it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the reset is intentionally keyed on the folder change
  useEffect(() => {
    selection.clear();
  }, [prefix]);

  const refresh = useCallback(() => router.refresh(), [router]);
  const uploads = useUploads(sourceId, prefix, refresh);
  // Renaming and moving keep the content (copy + delete of the old key under
  // the hood) — they're edits, gated on the edit capability alone.
  const canRename = permissions.upload;
  const canMove = permissions.upload;

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((prev) =>
      typeof updater === "function" ? updater(prev) : updater,
    );
  };

  const handleRenameEnd = (renamed: boolean) => {
    setRenameTarget(null);
    if (renamed) refresh();
  };

  const handleDuplicate = async (file: FileEntry) => {
    const result = await duplicateObject(sourceId, file.key);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("duplicatedToast", { name: file.name }));
    router.refresh();
  };

  const entries = useMemo(() => buildEntries(folders, files), [folders, files]);
  // Selection serves bulk download too, so it's on regardless of
  // permissions — only the bulk Delete button is permission-gated.
  const columns = useMemo(
    () => [
      createSelectColumn(columnsT),
      ...createBrowserColumns(columnsT, locale),
    ],
    [columnsT, locale],
  );

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
      onPreview: openPreview,
      onShare: canShare ? dialogs.openShare : undefined,
      onDetails: setDetails,
      onDelete: permissions.delete ? dialogs.openDelete : undefined,
      // Rename moves the object (write + delete), so it needs both.
      onRename: canRename ? setRenameTarget : undefined,
      // Duplicating creates content — an edit, like uploading.
      onDuplicate: permissions.upload ? handleDuplicate : undefined,
      onMove: canMove
        ? (entry) => dialogs.openMoveTo([toTarget(entry)])
        : undefined,
      renamingId: renameTarget
        ? renameTarget.kind === "folder"
          ? renameTarget.prefix
          : renameTarget.key
        : null,
      onRenameEnd: handleRenameEnd,
      onToggleSelect: selection.toggleSelect,
      activeId: details?.key ?? null,
    },
  });

  const rows = table.getRowModel().rows;
  const noMatches = query !== "" && rows.length === 0;
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  // Shift-click ranges follow the DISPLAYED order (folders first), not the
  // row model — hand the hook the ids in that order.
  selection.bindDisplayedIds(
    [
      ...rows.filter((row) => row.original.kind === "folder"),
      ...rows.filter((row) => row.original.kind === "file"),
    ].map((row) => row.id),
  );

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

  const deleteTarget =
    dialogs.dialog?.kind === "delete" ? dialogs.dialog.entry : null;
  const { deleting, handleDelete, handleBulkDelete } = useEntryDeletion({
    sourceId,
    deleteTarget,
    selectedRows,
    onDeleted: () => {
      dialogs.close();
      router.refresh();
    },
    onBulkSettled: () => {
      dialogs.close();
      selection.clear();
      router.refresh();
    },
  });

  const handleBulkDownload = useBulkDownload(sourceId, prefix, selectedRows);

  // Keyboard verbs on the current selection: Enter opens, F2 renames, Delete
  // deletes — skipped while typing or while an overlay is up.
  useBrowserShortcuts({
    sourceId,
    selectedRows,
    canRename,
    canDelete: permissions.delete,
    onPreview: openPreview,
    onDetails: setDetails,
    onRename: setRenameTarget,
    onBulkDelete: dialogs.openBulkDelete,
  });

  const gridSelection = {
    isSelected: (id: string) => rowSelection[id] === true,
    toggle: selection.toggleSelect,
    active: selectedCount > 0,
  };

  // Previewable files in display order — the dialog's ←/→ walk this list.
  const previewFiles = rows
    .map((row) => row.original)
    .filter(
      (entry): entry is Extract<BrowserEntry, { kind: "file" }> =>
        entry.kind === "file" && isPreviewable(entry.name),
    );

  const { dragging, dropZoneProps, drag } = useBrowserDnd({
    canUpload: permissions.upload,
    addFiles: uploads.addFiles,
    rowSelection,
    selectedRows,
    onMoveRequest: dialogs.openMove,
  });

  return (
    <div className="relative min-h-[calc(100dvh-6rem)]" {...dropZoneProps}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          {selectedCount > 0 ? (
            <SelectionToolbar
              selectedCount={selectedCount}
              allVisibleSelected={allVisibleSelected}
              onClear={selection.clear}
              onToggleSelectAll={toggleSelectAll}
              onBulkDownload={handleBulkDownload}
              bulkDownloadDisabled={selectedCount === 0}
              onCopyTo={() =>
                dialogs.openCopyTo(
                  selectedRows.map((row) => toTarget(row.original)),
                )
              }
              canMove={canMove}
              onMoveTo={() =>
                dialogs.openMoveTo(
                  selectedRows.map((row) => toTarget(row.original)),
                )
              }
              canDelete={permissions.delete}
              onBulkDelete={dialogs.openBulkDelete}
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
              sourceId={sourceId}
              prefix={prefix}
              onFolderCreated={refresh}
              onUploadFiles={uploads.addFiles}
              onSearchSource={dialogs.openSearch}
            />
          )}

          {noMatches ? (
            <EmptyState
              icon={SearchX}
              title={t("noMatchesTitle")}
              description={t("noMatchesDescription", { query })}
            >
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.setGlobalFilter("")}
                >
                  {t("clearFilter")}
                </Button>
                {/* The name might simply live in another folder — offer the
                    wider net right where the narrow one came up empty. */}
                <Button variant="outline" size="sm" onClick={openSearch}>
                  <FileSearch aria-hidden />
                  {t("searchEverywhere")}
                </Button>
              </div>
            </EmptyState>
          ) : entries.length === 0 ? (
            <EmptyFolder
              sourceId={sourceId}
              prefix={prefix}
              canUpload={permissions.upload}
            />
          ) : (
            <DndContext
              sensors={drag.sensors}
              onDragStart={drag.handleDragStart}
              onDragEnd={drag.handleDragEnd}
              onDragCancel={drag.handleDragCancel}
              // The parent drop zone only mounts mid-drag, so re-measure droppables
              // continuously to register it.
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            >
              {canMove && parentPrefix !== null && drag.activeDrag ? (
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
                  onPreview={openPreview}
                  onShare={canShare ? dialogs.openShare : undefined}
                  onDetails={setDetails}
                  onDelete={permissions.delete ? dialogs.openDelete : undefined}
                  onRename={canRename ? setRenameTarget : undefined}
                  onDuplicate={permissions.upload ? handleDuplicate : undefined}
                  onMove={
                    canMove
                      ? (entry) => dialogs.openMoveTo([toTarget(entry)])
                      : undefined
                  }
                  selection={gridSelection}
                  canMove={canMove}
                  renamingId={
                    renameTarget
                      ? renameTarget.kind === "folder"
                        ? renameTarget.prefix
                        : renameTarget.key
                      : null
                  }
                  onRenameEnd={handleRenameEnd}
                  activeId={details?.key ?? null}
                />
              ) : (
                <FileTable table={table} canMove={canMove} />
              )}
              <DragOverlay modifiers={[snapCenterToCursor]}>
                {drag.activeDrag ? (
                  <DragPreview
                    label={drag.activeDrag.label}
                    count={drag.activeDrag.count}
                    kind={drag.activeDrag.kind}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {details ? (
          <DetailsPanel
            sourceId={sourceId}
            file={details}
            onClose={() => setDetails(null)}
            onShare={canShare ? dialogs.openShare : undefined}
          />
        ) : null}
      </div>

      {dragging ? <DropOverlay /> : null}

      <BrowserDialogs
        sourceId={sourceId}
        dialogs={dialogs}
        sharePolicy={sharePolicy}
        preview={preview}
        previewFiles={previewFiles}
        onPreviewFileChange={openPreview}
        onClosePreview={() => setPreviewKey(null)}
        onShare={canShare ? dialogs.openShare : undefined}
        deleting={deleting}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        selectedCount={selectedCount}
        query={query}
        onMutationComplete={() => {
          dialogs.close();
          selection.clear();
          router.refresh();
        }}
      />

      <UploadTray
        items={uploads.items}
        onCancel={uploads.cancel}
        onRetry={uploads.retry}
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
  const t = useTranslations("browser.fileBrowser");
  // At the bucket root there is no parent to go back to.
  const parent = prefix ? (parentPrefixOf(prefix) ?? "") : null;

  return (
    <EmptyState
      icon={FolderOpen}
      title={t("emptyFolderTitle")}
      description={
        canUpload ? t("emptyFolderCanUpload") : t("emptyFolderReadOnly")
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
            {t("backToParent")}
          </Link>
        </Button>
      ) : null}
    </EmptyState>
  );
}
