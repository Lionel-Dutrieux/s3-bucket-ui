"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { browserQueries } from "@/features/browser/api/queries";
import type { ViewerProps } from "./types";

export function TextViewer({ sourceId, file }: ViewerProps) {
  const t = useTranslations("browser.viewers");
  const query = useQuery({
    ...browserQueries.textPreview(sourceId, file.key),
    enabled: file.size > 0,
  });

  if (file.size === 0) return <TextBody text="" />;
  if (query.isPending) {
    return (
      <Loader2
        className="size-6 animate-spin text-muted-foreground"
        aria-label={t("loadingPreview")}
      />
    );
  }
  if (query.error) {
    return (
      <p className="p-6 text-sm text-muted-foreground">{query.error.message}</p>
    );
  }
  return <TextBody text={query.data?.text} truncated={query.data?.truncated} />;
}

export function TruncatedBanner() {
  const t = useTranslations("browser.viewers");
  return (
    <p className="sticky top-0 border-b bg-muted px-4 py-1.5 text-xs text-muted-foreground">
      {t("truncatedBanner")}
    </p>
  );
}

function TextBody({ text, truncated }: { text?: string; truncated?: boolean }) {
  const t = useTranslations("browser.viewers");
  if (text === undefined || text === "") {
    return (
      <p className="p-6 text-sm text-muted-foreground">{t("emptyFile")}</p>
    );
  }
  return (
    <div className="h-full w-full self-stretch overflow-auto">
      {truncated ? <TruncatedBanner /> : null}
      <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs">
        {text}
      </pre>
    </div>
  );
}
