"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { Provenance } from "@/lib/config/resolve";

/** Small "env" / "custom" badge next to a field's label. */
export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const t = useTranslations("admin.runtimeConfig.provenance");
  if (provenance === "unset") return null;
  return (
    <Badge variant={provenance === "db" ? "default" : "outline"}>
      {provenance === "db" ? t("custom") : t("env")}
    </Badge>
  );
}
