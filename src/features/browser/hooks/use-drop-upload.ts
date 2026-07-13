"use client";

import { useRef, useState } from "react";
import {
  filesFromDataTransfer,
  type DroppedFile,
} from "@/features/browser/lib/drop";

/**
 * Drop-to-upload wiring for the browser surface: spreads `dropZoneProps` on
 * the container and shows an overlay while `dragging` is true. dragenter /
 * dragleave fire for every child the cursor crosses — a depth counter keeps
 * the overlay stable until the pointer truly leaves. Inert (empty props,
 * never dragging) when `enabled` is false.
 */
export function useDropUpload(
  enabled: boolean,
  onFiles: (files: DroppedFile[]) => void,
) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const dropZoneProps = enabled
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
            if (dropped.length > 0) onFiles(dropped);
          });
        },
      }
    : {};

  return { dragging, dropZoneProps };
}
