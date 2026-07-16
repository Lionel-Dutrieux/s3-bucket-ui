"use client";

import {
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useState } from "react";
import { toast } from "sonner";
import type { DragData, DropData } from "@/features/browser/components/dnd";
import type { MoveRequest } from "@/features/browser/components/move-dialog";
import {
  type EntryTarget,
  folderName,
  planMove,
} from "@/features/browser/lib/move";

export interface ActiveDrag {
  label: string;
  count: number;
  kind: "file" | "folder";
}

/**
 * Drag-and-drop move plumbing for the browser: sensors, the overlay's state,
 * and the drop handler that turns a drag into a confirmed MoveRequest.
 * `movingTargets` resolves what actually moves — the whole selection when the
 * dragged row is part of it, the single row otherwise.
 */
export function useEntryDrag({
  movingTargets,
  onMoveRequest,
}: {
  movingTargets: (dragged: DragData) => EntryTarget[];
  onMoveRequest: (request: MoveRequest) => void;
}) {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

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
    onMoveRequest({
      targets,
      destPrefix: over.prefix,
      destLabel,
      count: plan.moves.length,
    });
  };

  const handleDragCancel = () => setActiveDrag(null);

  return {
    activeDrag,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}
