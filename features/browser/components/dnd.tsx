"use client";

import {
  useDraggable,
  useDroppable,
  type DraggableAttributes,
} from "@dnd-kit/core";
import { CornerLeftUp } from "lucide-react";
import { useCallback } from "react";
import type { EntryTarget } from "@/features/browser/move";
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
