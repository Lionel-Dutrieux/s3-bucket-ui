"use client";

import { useRef, useState } from "react";
import {
  INITIAL_ZOOM,
  pan,
  type ZoomState,
  zoomAt,
} from "@/features/browser/lib/zoom";
import type { ViewerProps } from "./types";

/**
 * Image with wheel-zoom (cursor-anchored), drag-pan when zoomed, and
 * double-click to toggle 1x ↔ 2.5x. State resets per file via the shell's
 * key={file.key}.
 */
export function ImageViewer({ file, src, onError }: ViewerProps) {
  const [zoom, setZoom] = useState<ZoomState>(INITIAL_ZOOM);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(
    null,
  );

  /** Cursor position relative to the container center — zoom.ts's space. */
  const toLocal = (event: { clientX: number; clientY: number }) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { cx: 0, cy: 0 };
    return {
      cx: event.clientX - rect.left - rect.width / 2,
      cy: event.clientY - rect.top - rect.height / 2,
    };
  };

  const handleWheel = (event: React.WheelEvent) => {
    const { cx, cy } = toLocal(event);
    const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
    setZoom((state) => zoomAt(state, cx, cy, factor));
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    const { cx, cy } = toLocal(event);
    setZoom((state) =>
      state.scale > 1 ? INITIAL_ZOOM : zoomAt(state, cx, cy, 2.5),
    );
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (zoom.scale === 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setZoom((state) => pan(state, dx, dy));
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      role="application"
      className="flex h-full w-full items-center justify-center overflow-hidden"
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        cursor: zoom.scale > 1 ? "grab" : "zoom-in",
        touchAction: "none",
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: presigned bucket URL, not optimizable */}
      <img
        src={src}
        alt={file.name}
        onError={onError}
        draggable={false}
        className="max-h-full w-auto max-w-full object-contain select-none"
        style={{
          transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
          transition: dragRef.current ? "none" : "transform 120ms ease-out",
        }}
      />
    </div>
  );
}
