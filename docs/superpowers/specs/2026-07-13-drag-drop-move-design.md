# Drag-and-drop move — design

Move files and folders into another folder by dragging them, within a single
source (bucket). Built on `@dnd-kit`, reusing the existing `files.move`
(copy + delete) logic already used by rename.

## Goals

- In list **and** grid views, drag one or more files/folders onto a **folder**
  (row or tile), or onto a **"parent folder" drop zone** shown at the top of the
  view when not at the root, to move them there.
- Respect the current multi-selection: dragging a selected item moves the whole
  selection; dragging an unselected item moves just that item.
- A **confirmation dialog** before every move ("Move N item(s) into "folder"?").
- Every move is enforced server-side and recorded in the audit log.

## Non-goals (out of scope for this version)

- Moving between **different** sources (drag across buckets).
- Overwrite / auto-rename on name collision — a collision **refuses** the move
  (consistent with rename). Revisit later if needed.
- Progress bars for large folder moves — a spinner in the dialog is enough.
- Reordering; drag-to-upload (that already exists via the native file drop and
  stays independent).
- **Breadcrumb** as a drop target — it lives in the page header (a server
  component) outside the `DndContext`, which lives in `FileBrowser`. "Move to
  parent" is covered by the in-view parent drop zone instead; a droppable
  breadcrumb could come later via a page-level client shell.

## Approach

`@dnd-kit/core` (+ `@dnd-kit/utilities`). Chosen over react-dnd / native HTML5
DnD because dnd-kit is pointer-based, so it does **not** collide with the
existing native `DataTransfer` file-drop used for uploads; it is accessible
(keyboard sensor) and ships a clean `DragOverlay` for multi-item drags.

## Permissions

Moving is copy + delete, so it needs **both** `allowUpload` and `allowDelete`
on the source — exactly like rename. A `canMove = allowUpload && allowDelete`
flag is derived from the permissions the page already passes to `FileBrowser`
and threaded down. When false: nothing is draggable, no drop targets, no
overlay — the feature is invisible.

## Components & data flow

```
source/[id]/page.tsx
  └─ FileBrowser (canMove)
       └─ <DndContext sensors=[Pointer(distance 8px), Keyboard]>
            ├─ ParentDropZone     → droppable {prefix: parentPrefix}, shown when prefix !== ""
            ├─ FileTable          → each row: draggable(entry) + folder rows droppable
            ├─ FileGrid           → each tile: draggable(entry) + folder tiles droppable
            ├─ <DragOverlay>      → compact chip: icon+name, or "N items"
            └─ MoveDialog         → confirm → moveEntries() → toast + router.refresh()
```

- **Draggable** (`useDraggable`): file and folder rows/tiles. `id` = the entry's
  key (file) or prefix (folder); `data` carries the `EntryTarget`.
- **Droppable** (`useDroppable`): folder rows/tiles (`data: { prefix }`) and the
  parent drop zone (`data: { prefix: parentPrefix }`), rendered only when the
  current folder isn't the root. The current folder itself is never a target.
- **PointerSensor** activates after ~8px of movement, so a plain click still
  selects the row, toggles the checkbox, or opens the folder.
- **onDragStart**: the "moving set" = the current selection if the dragged entry
  is in it, otherwise just the dragged entry.
- **onDragEnd**: resolve the drop target's `prefix`; run the **client-side
  structural check** (mirrors the server guards) for instant feedback — ignore
  drops onto the source's current folder, onto itself, or into its own
  descendant. On a valid target, open `MoveDialog` with
  `{ targets, destPrefix, destLabel }`.
- **MoveDialog**: shadcn dialog, same idiom as rename/delete dialogs. Confirm →
  call `moveEntries` → on success clear the selection, toast, `router.refresh()`;
  on error, show the message.

## Server action: `moveEntries`

New export in `features/browser/write-actions.ts`:

```ts
moveEntries(
  sourceId: string,
  targets: EntryTarget[],
  destPrefix: string,   // "" (root) or ends with "/"
): Promise<{ error?: string }>
```

**Shared type rename**: `DeleteTarget` → **`EntryTarget`** (it now serves both
delete and move); update `deleteEntries` and the one importer (`file-browser`).

```ts
type EntryTarget =
  | { kind: "file"; key: string }
  | { kind: "folder"; prefix: string };
```

Algorithm:

1. **Input guards**: `destPrefix` is `""` or ends with `/`; `targets` non-empty
   and ≤ `MOVE_ENTRIES_MAX` (new limit in `limits.ts`, e.g. 500); folder targets
   end with `/`.
2. `withWriteAccess(sourceId, { need: { upload: true, delete: true }, denied:
   "Moving needs both upload and delete enabled on this source.", action:
   "move the selection" }, …)` — the server-side gate.
3. **Plan** (pure, via `features/browser/move.ts`): for each target compute the
   destination — file → `destPrefix + basename(key)`, folder →
   `destPrefix + folderName(prefix) + "/"`. Drop **no-ops** (source already in
   `destPrefix`). If any folder move targets **itself or a descendant**
   (`destPrefix` starts with the folder's prefix) → return an error, move
   nothing.
4. **Conflict pre-check** (I/O): for each planned move, `files.exists(destKey)`
   (file) or a one-item `files.list` under the destination folder prefix
   (folder). If **any** destination is occupied → return an error naming the
   conflict(s); move nothing. (All-or-nothing keeps the confirmation honest.)
5. **Execute**: files → `files.move(from, to)`; folders → `movePrefix(files,
   srcPrefix, destPrefix)` — the bounded copy+delete loop factored out of
   `renameFolder` into a shared helper. The folder-move caps in `limits.ts` are
   renamed `RENAME_FOLDER_MAX_OBJECTS` → `FOLDER_MOVE_MAX_OBJECTS`,
   `RENAME_FOLDER_CONCURRENCY` → `FOLDER_MOVE_CONCURRENCY`,
   `RENAME_FOLDER_LIST_BATCH` → `FOLDER_MOVE_LIST_BATCH`, and both `renameFolder`
   and `moveEntries` use them.
6. **Audit**: one summary entry — `recordOperation({ action: "move", target:
   "N item(s)", detail: → destPrefix })`. Add `"move"` to `OperationAction`
   (`lib/dal/operations.ts`) and a label/icon in
   `features/browser/operation-labels.ts` (non-destructive, e.g. `FolderInput`).
7. Return `{}` or `{ error }`. Folder moves are non-atomic, so on partial
   failure return a clear "some items may have moved already, refresh" message.

## Pure logic & testing

`features/browser/move.ts` (no `server-only`, so Vitest can import it) holds the
tricky, I/O-free rules, unit-tested in `move.test.ts` (same pattern as
`listing.ts` / `sort-param.ts`):

- `basename(key)` / `folderName(prefix)`.
- `destinationFor(target, destPrefix)` → destination key/prefix.
- `isNoop(target, destPrefix)` → source already in `destPrefix`.
- `isIntoSelfOrDescendant(folderPrefix, destPrefix)`.
- `planMove(targets, destPrefix)` → `{ moves: MoveOp[]; error?: string }`
  (applies no-op filtering + self/descendant guard). The conflict check stays
  in the action (needs I/O).

The server action, dialog and DnD wiring are verified manually (`pnpm dev`), per
the project's testing convention.

## Files touched

New:
- `features/browser/move.ts` + `move.test.ts` — pure move planning.
- `features/browser/components/move-dialog.tsx` — confirmation.

Changed:
- `features/browser/write-actions.ts` — `moveEntries`, `EntryTarget` rename,
  `movePrefix` helper shared with `renameFolder`.
- `features/browser/limits.ts` — add `MOVE_ENTRIES_MAX` (500); rename the
  `RENAME_FOLDER_*` caps to `FOLDER_MOVE_*` (shared by rename and move).
- `features/browser/components/file-browser.tsx` — `DndContext`, sensors,
  drag/drop handlers, `DragOverlay`, `MoveDialog` wiring, `canMove`.
- `features/browser/components/file-table.tsx`, `file-grid.tsx` — register
  draggable/droppable rows and tiles when `canMove`.
- `lib/dal/operations.ts` — `"move"` action.
- `features/browser/operation-labels.ts` — `move` label/icon.
- `package.json` — `@dnd-kit/core`, `@dnd-kit/utilities`.

## Verification

`pnpm typecheck && pnpm lint && pnpm test && pnpm build`, then manual DnD
checks in `pnpm dev` (move file into folder, move folder, multi-select move,
move to parent via the parent drop zone, no-op/self/conflict refusals,
permission-off = no DnD).
