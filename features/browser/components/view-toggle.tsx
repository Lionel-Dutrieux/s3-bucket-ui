"use client";

import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { VIEW_COOKIE, type ViewMode } from "@/features/browser/view";
import { cn } from "@/lib/utils";

const MODES = [
  { mode: "list", label: "List view", icon: List },
  { mode: "grid", label: "Grid view", icon: LayoutGrid },
] as const;

function persistView(mode: ViewMode) {
  document.cookie = `${VIEW_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

export function ViewToggle({ view }: { view: ViewMode }) {
  const router = useRouter();

  const select = (mode: ViewMode) => {
    if (mode === view) return;
    persistView(mode);
    router.refresh();
  };

  return (
    <div
      role="group"
      aria-label="View mode"
      className="flex items-center gap-0.5 rounded-md border p-0.5"
    >
      {MODES.map(({ mode, label, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          onClick={() => select(mode)}
          aria-pressed={view === mode}
          aria-label={label}
          title={label}
          className={cn(
            "flex size-6.5 items-center justify-center rounded-sm text-muted-foreground transition-colors",
            view === mode
              ? "bg-muted text-foreground"
              : "hover:text-foreground"
          )}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
