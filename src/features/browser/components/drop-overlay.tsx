import { Upload } from "lucide-react";

/** Full-surface overlay shown while files are dragged over the browser. */
export function DropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-[1px]">
      <div className="flex flex-col items-center gap-3 rounded-xl bg-background/95 px-6 py-5 text-center shadow-lg">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Upload className="size-6" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold">Drop to upload</p>
          <p className="text-xs text-muted-foreground">
            Release to add files to this folder
          </p>
        </div>
      </div>
    </div>
  );
}
