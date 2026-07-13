"use client";

import {
  type DraggableAttributes,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CornerLeftUp, Folder } from "lucide-react";
import { useCallback } from "react";
import { FileIcon } from "@/features/browser/components/file-icon";
import type { EntryTarget } from "@/features/browser/lib/move";
import { cn } from "@/lib/utils";

type SyntheticListenerMap = ReturnType<typeof useDraggable>["listeners"];

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

/**
 * Drop target for "move up to the parent folder". Rendered only while a drag
 * is in progress (see FileBrowser), so it's given a generous height to make an
 * easy target.
 */
export function ParentDropZone({ parentPrefix }: { parentPrefix: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "drop:parent",
    data: { prefix: parentPrefix },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mb-3 flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-sm font-medium transition-colors",
        isOver
          ? "border-primary bg-primary/10 text-foreground"
          : "border-muted-foreground/30 text-muted-foreground",
      )}
    >
      <CornerLeftUp className="size-4" aria-hidden />
      Drop here to move to the parent folder
    </div>
  );
}

/**
 * Overlay preview that follows the cursor during a drag — a small card echoing
 * the dragged entry (icon + name), with a stacked backdrop for multi-select.
 */
export function DragPreview({
  label,
  count,
  kind,
}: {
  label: string;
  count: number;
  kind: "file" | "folder";
}) {
  return (
    <div className="pointer-events-none relative w-max">
      {count > 1 ? (
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-lg border bg-muted shadow-sm" />
      ) : null}
      <div className="relative flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-lg">
        {kind === "folder" ? (
          <Folder
            className="size-4 shrink-0 fill-amber-400/80 text-amber-500"
            aria-hidden
          />
        ) : (
          <FileIcon name={label} className="size-4 shrink-0" />
        )}
        <span className="max-w-44 truncate text-sm font-medium">
          {count > 1 ? `${count} items` : label}
        </span>
      </div>
    </div>
  );
}
