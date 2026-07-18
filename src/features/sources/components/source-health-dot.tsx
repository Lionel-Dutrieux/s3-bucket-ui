"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { sourcesQueries } from "@/features/sources/api/queries";
import { cn } from "@/lib/utils";

/**
 * A subtle status pastille next to a source name in the sidebar. All dots
 * share one polled query (deduped by key), so the whole sidebar costs a single
 * request a minute. A fixed-size dot always renders — no layout shift between
 * loading/ok/error — coloured green (reachable), red (unreachable) or muted
 * (still checking).
 */
export function SourceHealthDot({ sourceId }: { sourceId: string }) {
  const t = useTranslations("layout.sidebar.health");
  const { data: status } = useQuery({
    ...sourcesQueries.health(),
    select: (map) => map[sourceId]?.status,
  });

  const label =
    status === "ok"
      ? t("reachable")
      : status === "error"
        ? t("unreachable")
        : t("checking");

  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        status === "ok" && "bg-emerald-500",
        status === "error" && "bg-red-500",
        status === undefined && "bg-muted-foreground/40",
      )}
      role="status"
      aria-label={label}
      title={label}
    />
  );
}
