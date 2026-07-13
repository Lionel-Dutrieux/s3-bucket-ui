# Drag-and-drop Move Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users move files and folders into another folder (or up to the parent) by dragging them, within a single source.

**Architecture:** A pure planning module (`move.ts`) computes destinations and structural guards and is unit-tested. A `moveEntries` server action reuses the existing `files.move` (copy+delete) plus a shared `movePrefix` helper, gated on upload+delete and audited. The UI uses `@dnd-kit` inside `FileBrowser`: rows/tiles are draggable, folders and an in-view "parent" zone are droppable, and a drop opens a confirmation dialog that calls `moveEntries`.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, TypeScript 7, `@dnd-kit/core` + `@dnd-kit/utilities`, TanStack Table, files-sdk, Prisma 7 (audit log), Biome, Vitest.

## Global Constraints

- Package manager: **pnpm** (`pnpm@10.28.2`). Add deps with `pnpm add`.
- Verify with `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Fix formatting with `pnpm lint:fix` (Biome).
- UI is verified manually (`pnpm dev`); only pure logic gets Vitest tests (project convention — `AGENTS.md`, `ARCHITECTURE.md`).
- Moving needs **both** `allowUpload` and `allowDelete` (move = copy + delete). Enforced server-side via `withWriteAccess`.
- Every write is audited via `recordOperation` (`lib/dal/operations.ts`).
- Feature branch: `worktree-review+postgres-and-quality`. Commit after each task.
- No new UI libraries beyond `@dnd-kit` (CONTRIBUTING: shadcn/ui + Tailwind idiom).
- The env module requires `DATABASE_URL`; for local `pnpm dev`/tests a `.env` already exists in the worktree.

## File Structure

New files:
- `features/browser/move.ts` — pure move planning (destinations, no-op / self-descendant guards). No `server-only`, so Vitest can import it.
- `features/browser/move.test.ts` — unit tests for the above.
- `features/browser/components/dnd.tsx` — dnd-kit glue: `DragData`/`DropData` types, `useEntryDnd` hook, `ParentDropZone`, `DragChip`.
- `features/browser/components/move-dialog.tsx` — confirmation dialog calling `moveEntries`.

Modified files:
- `features/browser/limits.ts` — rename `RENAME_FOLDER_*` → `FOLDER_MOVE_*`, add `MOVE_ENTRIES_MAX`.
- `features/browser/write-actions.ts` — `EntryTarget` type (re-exported), `movePrefix` helper shared by `renameFolder`, new `moveEntries`.
- `lib/dal/operations.ts` — add `"move"` to `OperationAction`.
- `features/browser/operation-labels.ts` — add `move` label/icon.
- `features/browser/components/file-table.tsx` — draggable/droppable rows when `canMove`.
- `features/browser/components/file-grid.tsx` — draggable/droppable cards when `canMove`.
- `features/browser/components/file-browser.tsx` — `DndContext`, sensors, drag handlers, `DragOverlay`, `ParentDropZone`, `MoveDialog`, `canMove`; rename `DeleteTarget`→`EntryTarget`.
- `package.json` — `@dnd-kit/core`, `@dnd-kit/utilities`.

---

### Task 1: Pure move-planning logic (`move.ts`) + tests

**Files:**
- Create: `features/browser/move.ts`
- Test: `features/browser/move.test.ts`

**Interfaces:**
- Produces:
  - `type EntryTarget = { kind: "file"; key: string } | { kind: "folder"; prefix: string }`
  - `interface MoveOp { kind: "file" | "folder"; from: string; to: string }`
  - `interface MovePlan { moves: MoveOp[]; error?: string }`
  - `basename(key: string): string`
  - `folderName(prefix: string): string`
  - `parentOf(target: EntryTarget): string`
  - `destinationFor(target: EntryTarget, destPrefix: string): string`
  - `isNoop(target: EntryTarget, destPrefix: string): boolean`
  - `isIntoSelfOrDescendant(folderPrefix: string, destPrefix: string): boolean`
  - `planMove(targets: EntryTarget[], destPrefix: string): MovePlan`

- [ ] **Step 1: Write the failing test**

Create `features/browser/move.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  basename,
  destinationFor,
  folderName,
  isIntoSelfOrDescendant,
  isNoop,
  parentOf,
  planMove,
  type EntryTarget,
} from "@/features/browser/move";

const file = (key: string): EntryTarget => ({ kind: "file", key });
const folder = (prefix: string): EntryTarget => ({ kind: "folder", prefix });

describe("basename / folderName", () => {
  it("basename strips the path", () => {
    expect(basename("a/b/c.txt")).toBe("c.txt");
    expect(basename("c.txt")).toBe("c.txt");
  });
  it("folderName strips path and trailing slash", () => {
    expect(folderName("a/b/")).toBe("b");
    expect(folderName("b/")).toBe("b");
  });
});

describe("parentOf", () => {
  it("returns the containing folder, '' at root", () => {
    expect(parentOf(file("a/b/c.txt"))).toBe("a/b/");
    expect(parentOf(file("c.txt"))).toBe("");
    expect(parentOf(folder("a/b/"))).toBe("a/");
    expect(parentOf(folder("b/"))).toBe("");
  });
});

describe("destinationFor", () => {
  it("computes file and folder destinations", () => {
    expect(destinationFor(file("a/c.txt"), "x/")).toBe("x/c.txt");
    expect(destinationFor(file("a/c.txt"), "")).toBe("c.txt");
    expect(destinationFor(folder("a/b/"), "x/")).toBe("x/b/");
    expect(destinationFor(folder("a/b/"), "")).toBe("b/");
  });
});

describe("guards", () => {
  it("isNoop when already in destPrefix", () => {
    expect(isNoop(file("a/c.txt"), "a/")).toBe(true);
    expect(isNoop(file("a/c.txt"), "b/")).toBe(false);
    expect(isNoop(folder("a/b/"), "a/")).toBe(true);
  });
  it("isIntoSelfOrDescendant", () => {
    expect(isIntoSelfOrDescendant("a/b/", "a/b/")).toBe(true);
    expect(isIntoSelfOrDescendant("a/b/", "a/b/c/")).toBe(true);
    expect(isIntoSelfOrDescendant("a/b/", "a/")).toBe(false);
    expect(isIntoSelfOrDescendant("a/b/", "")).toBe(false);
  });
});

describe("planMove", () => {
  it("drops no-ops and builds move ops", () => {
    const plan = planMove([file("a/c.txt"), file("a/keep.txt")], "x/");
    expect(plan.error).toBeUndefined();
    expect(plan.moves).toEqual([
      { kind: "file", from: "a/c.txt", to: "x/c.txt" },
      { kind: "file", from: "a/keep.txt", to: "x/keep.txt" },
    ]);
  });
  it("skips a target already in the destination", () => {
    const plan = planMove([file("a/c.txt")], "a/");
    expect(plan.moves).toEqual([]);
  });
  it("rejects moving a folder into itself or a descendant", () => {
    expect(planMove([folder("a/b/")], "a/b/c/").error).toBeDefined();
    expect(planMove([folder("a/b/")], "a/b/").moves).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run features/browser/move.test.ts`
Expected: FAIL — cannot resolve `@/features/browser/move`.

- [ ] **Step 3: Write the implementation**

Create `features/browser/move.ts`:

```ts
// Pure move planning — no I/O, unit-tested in move.test.ts.

export type EntryTarget =
  | { kind: "file"; key: string }
  | { kind: "folder"; prefix: string };

export interface MoveOp {
  kind: "file" | "folder";
  /** Source key (file) or prefix (folder). */
  from: string;
  /** Destination key (file) or prefix (folder). */
  to: string;
}

export interface MovePlan {
  moves: MoveOp[];
  error?: string;
}

/** "a/b/c.txt" → "c.txt" */
export function basename(key: string): string {
  return key.slice(key.lastIndexOf("/") + 1);
}

/** "a/b/" → "b" */
export function folderName(prefix: string): string {
  const withoutTrailing = prefix.slice(0, -1);
  return withoutTrailing.slice(withoutTrailing.lastIndexOf("/") + 1);
}

/** The folder a target currently lives in ("" = root). */
export function parentOf(target: EntryTarget): string {
  const path = target.kind === "file" ? target.key : target.prefix.slice(0, -1);
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash + 1);
}

/** Where a target lands under `destPrefix` ("" = root). */
export function destinationFor(
  target: EntryTarget,
  destPrefix: string,
): string {
  return target.kind === "file"
    ? destPrefix + basename(target.key)
    : `${destPrefix + folderName(target.prefix)}/`;
}

/** True when the target already sits directly in `destPrefix`. */
export function isNoop(target: EntryTarget, destPrefix: string): boolean {
  return parentOf(target) === destPrefix;
}

/** A folder can't move into itself or any path beneath it. */
export function isIntoSelfOrDescendant(
  folderPrefix: string,
  destPrefix: string,
): boolean {
  return destPrefix.startsWith(folderPrefix);
}

/**
 * Turns a selection + destination into concrete move ops. Drops no-ops
 * (already in the destination); returns an error if a folder would move into
 * itself or a descendant. I/O-free — the conflict check that needs the bucket
 * lives in the server action.
 */
export function planMove(
  targets: EntryTarget[],
  destPrefix: string,
): MovePlan {
  const moves: MoveOp[] = [];
  for (const target of targets) {
    if (isNoop(target, destPrefix)) continue;
    if (
      target.kind === "folder" &&
      isIntoSelfOrDescendant(target.prefix, destPrefix)
    ) {
      return { moves: [], error: "You can't move a folder into itself." };
    }
    moves.push({
      kind: target.kind,
      from: target.kind === "file" ? target.key : target.prefix,
      to: destinationFor(target, destPrefix),
    });
  }
  return { moves };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run features/browser/move.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add features/browser/move.ts features/browser/move.test.ts
git commit -m "feat(browser): pure move-planning logic + tests"
```

---

### Task 2: Shared refactor — limits, `EntryTarget`, `movePrefix`

Prep so `moveEntries` (Task 3) can reuse folder-move logic. No behavior change; verified by the full check suite.

**Files:**
- Modify: `features/browser/limits.ts`
- Modify: `features/browser/write-actions.ts`
- Modify: `features/browser/components/file-browser.tsx`

**Interfaces:**
- Consumes: `EntryTarget`, `basename`, `folderName` from Task 1 (`@/features/browser/move`).
- Produces:
  - `limits.ts`: `FOLDER_MOVE_MAX_OBJECTS`, `FOLDER_MOVE_CONCURRENCY`, `FOLDER_MOVE_LIST_BATCH`, `MOVE_ENTRIES_MAX`.
  - `write-actions.ts`: re-exports `EntryTarget`; `movePrefix(files, srcPrefix, destPrefix): Promise<{ error?: string; count?: number }>`.

- [ ] **Step 1: Rename the folder-move limits and add the move cap**

In `features/browser/limits.ts`, replace the `RENAME_FOLDER_*` block with:

```ts
/** Renaming/moving a folder moves each object (copy + delete) — bounded so a
 * server action can't churn through a giant prefix. */
export const FOLDER_MOVE_MAX_OBJECTS = 1000;
/** Objects moved in parallel while renaming/moving a folder. */
export const FOLDER_MOVE_CONCURRENCY = 10;
/** Keys listed per page while collecting a folder's contents to move. */
export const FOLDER_MOVE_LIST_BATCH = 1000;
```

And add next to `DELETE_ENTRIES_MAX`:

```ts
/** Maximum items in one drag-and-drop move. */
export const MOVE_ENTRIES_MAX = 500;
```

- [ ] **Step 2: Extract `movePrefix` and rewire `renameFolder`; rename `DeleteTarget`→`EntryTarget`**

In `features/browser/write-actions.ts`:

Replace the limits import and add the move import:

```ts
import type { Files } from "files-sdk";
import { withWriteAccess } from "@/features/browser/guards";
import {
  DELETE_ENTRIES_MAX,
  DELETE_FOLDER_BATCH,
  DELETE_FOLDER_MAX_ROUNDS,
  FOLDER_MOVE_CONCURRENCY,
  FOLDER_MOVE_LIST_BATCH,
  FOLDER_MOVE_MAX_OBJECTS,
} from "@/features/browser/limits";
import { type EntryTarget } from "@/features/browser/move";
import { recordOperation } from "@/lib/dal/operations";

export type { EntryTarget };
```

Delete the local `DeleteTarget` type definition and change `deleteEntries`'s parameter to `targets: EntryTarget[]`.

Add the shared helper (place it above `renameFolder`):

```ts
/**
 * Moves every object under `srcPrefix` to `destPrefix` (copy + delete each),
 * bounded. Returns the moved count, or an error string when the prefix is too
 * large. Shared by folder rename and folder move.
 */
async function movePrefix(
  files: Files,
  srcPrefix: string,
  destPrefix: string,
): Promise<{ error?: string; count?: number }> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await files.list({
      prefix: srcPrefix,
      cursor,
      limit: FOLDER_MOVE_LIST_BATCH,
    });
    keys.push(...page.items.map((item) => item.key));
    cursor = page.cursor;
    if (keys.length > FOLDER_MOVE_MAX_OBJECTS) {
      return {
        error: `This folder holds more than ${FOLDER_MOVE_MAX_OBJECTS} objects — too large to move in one go.`,
      };
    }
  } while (cursor);

  for (let i = 0; i < keys.length; i += FOLDER_MOVE_CONCURRENCY) {
    await Promise.all(
      keys
        .slice(i, i + FOLDER_MOVE_CONCURRENCY)
        .map((key) => files.move(key, destPrefix + key.slice(srcPrefix.length))),
    );
  }
  return { count: keys.length };
}
```

Rewrite the body of `renameFolder`'s `withWriteAccess` callback to use it (keep the conflict check and the audit entry):

```ts
    async ({ source, files }) => {
      const parent = prefix.slice(
        0,
        prefix.lastIndexOf("/", prefix.length - 2) + 1,
      );
      const newPrefix = `${parent}${trimmed}/`;
      if (newPrefix === prefix) return {};

      const conflict = await files.list({ prefix: newPrefix, limit: 1 });
      if (conflict.items.length > 0) {
        return { error: "A folder with that name already exists here." };
      }

      const result = await movePrefix(files, prefix, newPrefix);
      if (result.error) return { error: result.error };

      await recordOperation({
        action: "rename-folder",
        sourceId: source.id,
        sourceName: source.name,
        target: prefix,
        detail: `→ ${trimmed}/ (${result.count} object${result.count === 1 ? "" : "s"})`,
      });
      return {};
    },
```

Remove the now-unused `RENAME_FOLDER_*` references from the imports (done in Step 1's rename).

- [ ] **Step 3: Update the `DeleteTarget` importer**

In `features/browser/components/file-browser.tsx`, change the import and the one usage:

```ts
import {
  deleteEntries,
  deleteFolder,
  deleteObject,
  type EntryTarget,
} from "@/features/browser/write-actions";
```

And in `handleBulkDelete`, change the type annotation:

```ts
    const targets: EntryTarget[] = selectedRows.map((row) =>
```

- [ ] **Step 4: Verify no behavior change**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green (42 tests pass; no `DeleteTarget`/`RENAME_FOLDER_*` references remain — confirm with `git grep -n "DeleteTarget\|RENAME_FOLDER_"` returning nothing).

- [ ] **Step 5: Commit**

```bash
git add features/browser/limits.ts features/browser/write-actions.ts features/browser/components/file-browser.tsx
git commit -m "refactor(browser): share movePrefix, rename DeleteTarget→EntryTarget, FOLDER_MOVE_* limits"
```

---

### Task 3: `moveEntries` server action + `move` audit

**Files:**
- Modify: `features/browser/write-actions.ts`
- Modify: `lib/dal/operations.ts`
- Modify: `features/browser/operation-labels.ts`

**Interfaces:**
- Consumes: `withWriteAccess`, `movePrefix`, `EntryTarget`, `planMove`, `basename`, `folderName`, `MOVE_ENTRIES_MAX`.
- Produces: `moveEntries(sourceId: string, targets: EntryTarget[], destPrefix: string): Promise<{ error?: string }>`.

- [ ] **Step 1: Add the `"move"` audit action**

In `lib/dal/operations.ts`, add `"move"` to the `OperationAction` union:

```ts
export type OperationAction =
  | "upload"
  | "create-folder"
  | "delete"
  | "delete-folder"
  | "delete-many"
  | "rename"
  | "rename-folder"
  | "move";
```

- [ ] **Step 2: Add the label/icon**

In `features/browser/operation-labels.ts`, import `FolderInput` and add the entry:

```ts
import {
  FolderInput,
  FolderPlus,
  Pencil,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
```

Add to `LABELS`:

```ts
  move: { label: "Moved", icon: FolderInput },
```

- [ ] **Step 3: Add `moveEntries`**

In `features/browser/write-actions.ts`, **replace** the move import added in Task 2 with:

```ts
import {
  basename,
  type EntryTarget,
  folderName,
  planMove,
} from "@/features/browser/move";
```

and add `MOVE_ENTRIES_MAX` to the `@/features/browser/limits` import. Then add the action at the end of the file:

```ts
/**
 * Moves a selection of files/folders into `destPrefix` ("" = root). Move is
 * copy + delete, so it needs both write permissions. All-or-nothing on name
 * conflicts: if any destination is occupied, nothing moves.
 */
export async function moveEntries(
  sourceId: string,
  targets: EntryTarget[],
  destPrefix: string,
): Promise<{ error?: string }> {
  if (destPrefix !== "" && !destPrefix.endsWith("/")) {
    return { error: "Invalid destination." };
  }
  if (targets.length === 0) return {};
  if (targets.length > MOVE_ENTRIES_MAX) {
    return { error: `Move at most ${MOVE_ENTRIES_MAX} items at a time.` };
  }
  if (
    targets.some(
      (target) => target.kind === "folder" && !target.prefix.endsWith("/"),
    )
  ) {
    return { error: "Invalid folder." };
  }

  const plan = planMove(targets, destPrefix);
  if (plan.error) return { error: plan.error };
  if (plan.moves.length === 0) return {};

  return withWriteAccess(
    sourceId,
    {
      need: { upload: true, delete: true },
      denied: "Moving needs both upload and delete enabled on this source.",
      action: "move the selection",
      failureMessage:
        "Could not move everything — some items may have moved already, refresh to check.",
    },
    async ({ source, files }) => {
      // Conflict pre-check: refuse the whole move if any destination exists.
      const conflicts: string[] = [];
      for (const move of plan.moves) {
        if (move.kind === "file") {
          if (await files.exists(move.to)) conflicts.push(basename(move.to));
        } else {
          const existing = await files.list({ prefix: move.to, limit: 1 });
          if (existing.items.length > 0) conflicts.push(folderName(move.to));
        }
      }
      if (conflicts.length > 0) {
        return {
          error: `Already exists in the destination: ${conflicts.join(", ")}.`,
        };
      }

      for (const move of plan.moves) {
        if (move.kind === "file") {
          await files.move(move.from, move.to);
        } else {
          const result = await movePrefix(files, move.from, move.to);
          if (result.error) return { error: result.error };
        }
      }

      await recordOperation({
        action: "move",
        sourceId: source.id,
        sourceName: source.name,
        target: `${plan.moves.length} item${plan.moves.length === 1 ? "" : "s"}`,
        detail: `→ ${destPrefix || "/"}`,
      });
      return {};
    },
  );
}
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add features/browser/write-actions.ts lib/dal/operations.ts features/browser/operation-labels.ts
git commit -m "feat(browser): moveEntries server action + move audit action"
```

---

### Task 4: `MoveDialog` confirmation

**Files:**
- Create: `features/browser/components/move-dialog.tsx`

**Interfaces:**
- Consumes: `moveEntries`, `EntryTarget` (`@/features/browser/write-actions`).
- Produces:
  - `interface MoveRequest { targets: EntryTarget[]; destPrefix: string; destLabel: string; count: number }`
  - `MoveDialog({ sourceId, request, onOpenChange, onMoved }): JSX.Element` where `onOpenChange: (open: boolean) => void`, `onMoved: () => void`.

- [ ] **Step 1: Write the component**

Create `features/browser/components/move-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  type EntryTarget,
  moveEntries,
} from "@/features/browser/write-actions";
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
  const [pending, setPending] = useState(false);

  const handleMove = async () => {
    if (!request) return;
    setPending(true);
    const result = await moveEntries(
      sourceId,
      request.targets,
      request.destPrefix,
    );
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Moved ${request.count} item${request.count === 1 ? "" : "s"}`,
    );
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
            Move {request?.count} item{request?.count === 1 ? "" : "s"} into “
            {request?.destLabel}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Moving copies each object to the destination and deletes the
            original. Folders move everything inside them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              handleMove();
            }}
            disabled={pending}
          >
            {pending ? "Moving…" : "Move"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck && pnpm lint`
Expected: green (the component is unused for now — that's fine; it's wired in Task 6).

- [ ] **Step 3: Commit**

```bash
git add features/browser/components/move-dialog.tsx
git commit -m "feat(browser): move confirmation dialog"
```

---

### Task 5: dnd-kit glue (`dnd.tsx`)

**Files:**
- Modify: `package.json` (add deps)
- Create: `features/browser/components/dnd.tsx`

**Interfaces:**
- Consumes: `EntryTarget` (`@/features/browser/move`).
- Produces:
  - `interface DragData { target: EntryTarget; label: string; rowId: string }`
  - `interface DropData { prefix: string }`
  - `useEntryDnd(opts: { rowId: string; data: DragData; droppablePrefix?: string; disabled?: boolean }): { setNodeRef: (node: HTMLElement | null) => void; listeners; attributes; isDragging: boolean; isOver: boolean }`
  - `ParentDropZone({ parentPrefix }: { parentPrefix: string }): JSX.Element`
  - `DragChip({ label, count }: { label: string; count: number }): JSX.Element`

- [ ] **Step 1: Add the dependencies**

Run:

```bash
pnpm add @dnd-kit/core @dnd-kit/utilities
```

Expected: adds `@dnd-kit/core` and `@dnd-kit/utilities` to `dependencies`.

- [ ] **Step 2: Write the glue module**

Create `features/browser/components/dnd.tsx`:

```tsx
"use client";

import {
  useDraggable,
  useDroppable,
  type DraggableAttributes,
} from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { CornerLeftUp } from "lucide-react";
import { useCallback } from "react";
import type { EntryTarget } from "@/features/browser/move";
import { cn } from "@/lib/utils";

export interface DragData {
  target: EntryTarget;
  /** Display name of the dragged entry (used by the overlay). */
  label: string;
  /** Table row id — file key or folder prefix — to match against selection. */
  rowId: string;
}

export interface DropData {
  prefix: string;
}

interface EntryDndResult {
  setNodeRef: (node: HTMLElement | null) => void;
  listeners: SyntheticListenerMap | undefined;
  attributes: DraggableAttributes;
  isDragging: boolean;
  isOver: boolean;
}

/**
 * Wires one row/tile as a drag source, and (for folders) also as a drop
 * target, merging both dnd-kit refs onto the single element. `isOver` is only
 * ever true when the element is droppable.
 */
export function useEntryDnd(opts: {
  rowId: string;
  data: DragData;
  droppablePrefix?: string;
  disabled?: boolean;
}): EntryDndResult {
  const droppable = opts.droppablePrefix !== undefined;
  const drag = useDraggable({
    id: `drag:${opts.rowId}`,
    data: opts.data,
    disabled: opts.disabled,
  });
  const drop = useDroppable({
    id: `drop:${opts.rowId}`,
    data: droppable ? { prefix: opts.droppablePrefix } : undefined,
    disabled: opts.disabled || !droppable,
  });

  const dragRef = drag.setNodeRef;
  const dropRef = drop.setNodeRef;
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      dragRef(node);
      if (droppable) dropRef(node);
    },
    [dragRef, dropRef, droppable],
  );

  return {
    setNodeRef,
    listeners: drag.listeners,
    attributes: drag.attributes,
    isDragging: drag.isDragging,
    isOver: droppable && drop.isOver,
  };
}

/** Drop target for "move up to the parent folder", shown when not at root. */
export function ParentDropZone({ parentPrefix }: { parentPrefix: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "drop:parent",
    data: { prefix: parentPrefix },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mb-3 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors",
        isOver
          ? "border-primary bg-primary/10 text-foreground"
          : "border-muted-foreground/30",
      )}
    >
      <CornerLeftUp className="size-4" aria-hidden />
      Drop here to move to the parent folder
    </div>
  );
}

/** Compact overlay chip that follows the cursor during a drag. */
export function DragChip({ label, count }: { label: string; count: number }) {
  return (
    <div className="pointer-events-none rounded-md border bg-background px-2.5 py-1.5 text-sm font-medium shadow-lg">
      {count > 1 ? `${count} items` : label}
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm typecheck && pnpm lint`
Expected: green. If the `SyntheticListenerMap` import path errors, replace that import line with `type SyntheticListenerMap = Record<string, (event: unknown) => void>;` declared locally and drop the import.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml features/browser/components/dnd.tsx
git commit -m "feat(browser): dnd-kit glue (useEntryDnd, ParentDropZone, DragChip)"
```

---

### Task 6: Wire DnD into the browser (table, grid, orchestration)

Make rows/tiles draggable and folders droppable, wrap everything in a `DndContext`, and open `MoveDialog` on a valid drop. UI is tuned manually in `pnpm dev`.

**Files:**
- Modify: `features/browser/components/file-table.tsx`
- Modify: `features/browser/components/file-grid.tsx`
- Modify: `features/browser/components/file-browser.tsx`

**Interfaces:**
- Consumes: `useEntryDnd`, `ParentDropZone`, `DragChip`, `DragData`, `DropData` (Task 5); `MoveDialog`, `MoveRequest` (Task 4); `planMove`, `parentOf`, `EntryTarget` (Task 1/2).

- [ ] **Step 1: Make table rows draggable/droppable**

In `features/browser/components/file-table.tsx`, add `canMove` to the props and render rows through a `BrowserRow` component. Replace the file's body with:

```tsx
"use client";

import {
  flexRender,
  type Header,
  type Row,
  type Table as TableInstance,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useEntryDnd } from "@/features/browser/components/dnd";
import type { BrowserEntry } from "@/features/browser/entries";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function FileTable({
  table,
  canMove,
}: {
  table: TableInstance<BrowserEntry>;
  canMove: boolean;
}) {
  const rows = table.getRowModel().rows;
  const ordered = [
    ...rows.filter((row) => row.original.kind === "folder"),
    ...rows.filter((row) => row.original.kind === "file"),
  ];

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="hover:bg-transparent">
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={header.column.columnDef.meta?.headClassName}
              >
                {header.isPlaceholder ? null : header.column.getCanSort() ? (
                  <SortButton header={header} />
                ) : (
                  flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {ordered.map((row) => (
          <BrowserRow key={row.id} row={row} canMove={canMove} />
        ))}
      </TableBody>
    </Table>
  );
}

function BrowserRow({
  row,
  canMove,
}: {
  row: Row<BrowserEntry>;
  canMove: boolean;
}) {
  const entry = row.original;
  const dnd = useEntryDnd({
    rowId: row.id,
    data: {
      target:
        entry.kind === "folder"
          ? { kind: "folder", prefix: entry.prefix }
          : { kind: "file", key: entry.key },
      label: entry.name,
      rowId: row.id,
    },
    droppablePrefix: entry.kind === "folder" ? entry.prefix : undefined,
    disabled: !canMove,
  });

  return (
    <TableRow
      ref={canMove ? dnd.setNodeRef : undefined}
      className={cn(
        "group",
        canMove && "cursor-grab",
        dnd.isDragging && "opacity-40",
        dnd.isOver && "bg-primary/10 outline outline-2 outline-primary",
      )}
      {...(canMove ? dnd.attributes : {})}
      {...(canMove ? dnd.listeners : {})}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cell.column.columnDef.meta?.cellClassName}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

function SortButton({ header }: { header: Header<BrowserEntry, unknown> }) {
  const sorted = header.column.getIsSorted();
  const Icon = !sorted
    ? ChevronsUpDown
    : sorted === "asc"
      ? ArrowUp
      : ArrowDown;
  const label = flexRender(header.column.columnDef.header, header.getContext());
  const alignRight =
    header.column.columnDef.meta?.cellClassName?.includes("text-right");

  return (
    <button
      type="button"
      onClick={header.column.getToggleSortingHandler()}
      className={cn(
        "inline-flex h-full w-full items-center gap-1 hover:text-foreground",
        alignRight && "justify-end",
        sorted && "text-foreground",
      )}
      aria-label={`Sort by ${header.column.id}`}
    >
      {label}
      <Icon className={cn("size-3.5", !sorted && "opacity-40")} aria-hidden />
    </button>
  );
}
```

- [ ] **Step 2: Make grid cards draggable/droppable**

In `features/browser/components/file-grid.tsx`, add `canMove?: boolean` to the props, extract the folder card and file card into `FolderCard`/`FileCard` components that call `useEntryDnd`, and apply `ref`/`listeners`/`attributes` + highlight to the outer card `div`. Add the import:

```tsx
import { useEntryDnd } from "@/features/browser/components/dnd";
```

Add `canMove = false` to the destructured props of `FileGrid`, and replace the folder `.map(...)` body with `<FolderCard key={folder.prefix} sourceId={sourceId} folder={folder} canMove={canMove} selection={selection} onRename={onRename} onDelete={onDelete} />` and the file `.map(...)` body with `<FileCard key={file.key} sourceId={sourceId} file={file} canMove={canMove} selection={selection} {...fileHandlers} />`. Define the two components at the bottom of the file, moving the existing card JSX into them and wrapping the outer `div` like:

```tsx
function FolderCard({ sourceId, folder, canMove, selection, onRename, onDelete }: {
  sourceId: string;
  folder: FolderEntry;
  canMove: boolean;
  selection?: GridSelection;
  onRename?: (entry: BrowserEntry) => void;
  onDelete?: (entry: BrowserEntry) => void;
}) {
  const dnd = useEntryDnd({
    rowId: folder.prefix,
    data: { target: { kind: "folder", prefix: folder.prefix }, label: folder.name, rowId: folder.prefix },
    droppablePrefix: folder.prefix,
    disabled: !canMove,
  });
  return (
    <div
      ref={canMove ? dnd.setNodeRef : undefined}
      {...(canMove ? dnd.attributes : {})}
      {...(canMove ? dnd.listeners : {})}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg border bg-card px-3.5 py-3 transition-colors hover:bg-muted/50",
        canMove && "cursor-grab",
        dnd.isDragging && "opacity-40",
        dnd.isOver && "outline outline-2 outline-primary",
      )}
    >
      {/* …existing folder card inner JSX… */}
    </div>
  );
}
```

`FileCard` is the same shape but `droppablePrefix` omitted (files aren't drop targets) and it carries the file's preview/copy/details/rename/delete handlers. Keep the existing inner JSX verbatim; only the outer `div` gains the `ref`/`listeners`/`attributes`/classes.

> Note: the folder card has an absolutely-positioned overlay `<Link>` covering it. dnd-kit's activation distance (Step 3) lets a click still follow the link while a drag past the threshold starts a move. Confirm this in manual testing (Step 6); if the link swallows drags, add `onClick`-guarded `draggable={false}` to the overlay link or move the listeners to a dedicated drag handle.

- [ ] **Step 3: Add `DndContext`, handlers, overlay and dialog in `file-browser.tsx`**

Add imports:

```ts
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  DragChip,
  ParentDropZone,
  type DragData,
  type DropData,
} from "@/features/browser/components/dnd";
import { MoveDialog, type MoveRequest } from "@/features/browser/components/move-dialog";
import { folderName, planMove, type EntryTarget as MoveTarget } from "@/features/browser/move";
```

Add state and the `canMove` flag near the other `useState`s / `canRename`:

```ts
  const canMove = permissions.upload && permissions.delete;
  const [activeDrag, setActiveDrag] = useState<{ label: string; count: number } | null>(null);
  const [moveRequest, setMoveRequest] = useState<MoveRequest | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
```

Add a helper that turns the dragged entry + current selection into the moving set, and the drag handlers (place above the `return`):

```ts
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
    setActiveDrag({ label: data.label, count });
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
```

(`folderName` from `move.ts` turns `"a/b/"` into `"b"` for the destination label — no extra helper needed.)

Compute the parent prefix for the drop zone (near `entries`/`rows`):

```ts
  const parentPrefix =
    prefix === ""
      ? null
      : (() => {
          const segments = prefix.split("/").filter(Boolean);
          return segments.length > 1
            ? `${segments.slice(0, -1).join("/")}/`
            : "";
        })();
```

Wrap the list/grid region in a `DndContext`. Change the view-switch block so the `FileGrid`/`FileTable` (and the `ParentDropZone`) are inside it, and pass `canMove`:

```tsx
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDrag(null)}
        >
          {canMove && parentPrefix !== null ? (
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
          <DragOverlay>
            {activeDrag ? (
              <DragChip label={activeDrag.label} count={activeDrag.count} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
```

> Keep the existing `noMatches` / `entries.length === 0` branches unchanged — only the final `view === "grid" ? … : …` branch moves inside `DndContext`.

Add the dialog next to the other dialogs (before `</div>` / near `<RenameDialog>`):

```tsx
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
```

- [ ] **Step 4: Verify build**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green. Run `pnpm lint:fix` if Biome reports formatting.

- [ ] **Step 5: Commit**

```bash
git add features/browser/components/file-table.tsx features/browser/components/file-grid.tsx features/browser/components/file-browser.tsx
git commit -m "feat(browser): drag-and-drop move (dnd-kit context, targets, dialog)"
```

- [ ] **Step 6: Manual verification (`pnpm dev`)**

Requires a source with **both** upload and delete enabled, containing at least one subfolder and a few files.

Check each:
- Drag a file onto a folder row (list) → confirm dialog → Move → file gone from here, present inside the folder; Activity shows "Moved".
- Same in grid view (drag a file card onto a folder card).
- Multi-select 2–3 items, drag one of them → dialog says "Move 3 items…" → all move.
- Drag a folder into another folder → moves recursively.
- Inside a subfolder, drag an item onto the "parent folder" drop zone → moves up.
- No-op: drag an item onto the folder it's already in → nothing happens, no dialog.
- Self: drag a folder onto itself → error toast "can't move a folder into itself" (or silently ignored for no-op).
- Conflict: move a file whose name already exists at the destination → error toast, nothing moved.
- A source with only one of upload/delete → no drag cursor, no drop highlight, dialog never appears.
- Regression: single click still selects a row / toggles a checkbox / opens a folder / triggers preview; the upload drop overlay ("Drop files to upload") still works when dragging OS files in.

Fix any interaction issues (drag vs. link/checkbox) by moving the drag listeners to a dedicated handle if needed (see Step 2 note), then re-run Step 4 and amend the commit.

---

## Notes for the implementer

- `EntryTarget` has one definition (`move.ts`); `write-actions.ts` re-exports it. Never redefine it.
- `planMove` is the single source of truth for move validity — the client uses it for the pre-drop check and the server action uses it before touching the bucket. Don't duplicate the rules.
- Highlighting shows on any folder you hover (`isOver`); correctness is enforced by `planMove` on drop and by the server. Refining highlight-only-when-valid is a future improvement, not part of this plan.
