import { cn } from "@/lib/utils";

/**
 * File name that keeps its tail visible when it overflows: the end of a name
 * (counter, date, extension) is usually what tells two files apart, so the
 * ellipsis lands in the middle — the Finder pattern. The full name stays
 * available in the title tooltip.
 */
export function EntryName({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  // Short names can't meaningfully overflow a card — skip the split.
  if (name.length <= 18) {
    return (
      <span className={cn("block truncate", className)} title={name}>
        {name}
      </span>
    );
  }
  const head = name.slice(0, -9);
  const tail = name.slice(-9);
  return (
    <span className={cn("flex min-w-0", className)} title={name}>
      <span className="truncate">{head}</span>
      <span className="shrink-0">{tail}</span>
    </span>
  );
}
