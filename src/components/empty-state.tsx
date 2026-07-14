import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared empty / no-result state: dashed frame, icon tile, title, one-line
 * description and an optional action below. `tone="primary"` tints the tile
 * for inviting first-run states; the default stays neutral.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  tone = "muted",
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  tone?: "muted" | "primary";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-xl",
          tone === "primary"
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}
