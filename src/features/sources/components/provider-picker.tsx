"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  providerHint,
  searchProviders,
} from "@/features/sources/components/provider-catalog";
import { ProviderPlate } from "@/features/sources/components/provider-logos";
import { getProvider } from "@/lib/storage/providers";

/**
 * The provider wall: a searchable grid of technology cards, grouped by how
 * they behave (object stores hand out links, protocols stream through the
 * app). Picking a card is the first step of adding a source.
 */
export function ProviderPicker({
  onSelect,
  localFsEnabled,
}: {
  onSelect: (providerId: string) => void;
  localFsEnabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const groups = searchProviders(query, { localFsEnabled });
  const t = useTranslations("sources");

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("picker.searchPlaceholder")}
          aria-label={t("picker.searchAria")}
          autoFocus
          spellCheck={false}
          className="pl-9"
        />
      </div>

      <div className="-mr-2 max-h-[55vh] space-y-4 overflow-y-auto pr-2">
        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t.rich("picker.noProviderMatch", {
              query,
              label: getProvider("s3-compatible")?.label ?? "S3-compatible",
              link: (chunks) => (
                <button
                  type="button"
                  onClick={() => onSelect("s3-compatible")}
                  className="underline underline-offset-3 hover:text-foreground"
                >
                  {chunks}
                </button>
              ),
            })}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="space-y-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.providers.map((def) => (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => onSelect(def.id)}
                    className="flex flex-col items-start gap-2.5 rounded-lg border bg-card p-3 text-left transition-colors outline-none hover:border-ring/60 hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <ProviderPlate providerId={def.id} className="size-9" />
                    <span className="block min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {def.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {providerHint(def.id)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
