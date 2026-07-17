"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const MODES = [
  { mode: "light", labelKey: "light", icon: Sun },
  { mode: "dark", labelKey: "dark", icon: Moon },
  { mode: "system", labelKey: "system", icon: Monitor },
] as const;

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("layout.themeToggle");
  // Theme is unknown until mounted (localStorage) — avoid a hydration mismatch.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: segmented control, not a form fieldset
    <div
      role="group"
      aria-label={t("groupLabel")}
      className="flex items-center gap-0.5 rounded-md border p-0.5"
    >
      {MODES.map(({ mode, labelKey, icon: Icon }) => {
        const isActive = mounted && theme === mode;
        const label = t(labelKey);
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setTheme(mode)}
            aria-pressed={isActive}
            aria-label={label}
            title={label}
            className={cn(
              "flex size-6.5 items-center justify-center rounded-sm text-muted-foreground transition-colors",
              isActive ? "bg-muted text-foreground" : "hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
