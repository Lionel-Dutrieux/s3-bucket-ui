"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common.errorPage");
  useEffect(() => {
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <CircleAlert className="size-5" aria-hidden />
        </div>
        <h1 className="text-base font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {error.digest
            ? t("descriptionWithDigest", { digest: error.digest })
            : t("description")}
        </p>
        <Button variant="outline" size="sm" onClick={reset} className="mt-1">
          <RotateCcw aria-hidden />
          {t("retry")}
        </Button>
      </div>
    </main>
  );
}
