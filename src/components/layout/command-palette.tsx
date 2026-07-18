"use client";

import { FileSearch, Plus, Settings2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { OPEN_SOURCE_SEARCH_EVENT } from "@/features/browser/lib/search-event";
import { providerIcon } from "@/features/sources/components/provider-icons";
import type { SourceSummary } from "@/lib/dal/sources";

/** Window event that opens the palette from anywhere (sidebar button). */
export const OPEN_COMMAND_PALETTE_EVENT = "bucket-ui:command-palette";

/** Ctrl/Cmd+K palette: jump to a source, or to the admin area (admins). */
export function CommandPalette({
  sources,
  canManage,
}: {
  sources: SourceSummary[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("layout.commandPalette");
  // File search only makes sense while browsing a source — the palette
  // handles navigation, the browser handles its own content.
  const onSourcePage = /^\/source\//.test(pathname);

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    // The sidebar search button lives in another tree — it asks for the
    // palette through this event instead of threading state up the layout.
    const onOpenRequest = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenRequest);
    };
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("title")}
      description={t("description")}
    >
      {/* This CommandDialog doesn't wrap children in <Command> itself. */}
      <Command>
        <CommandInput placeholder={t("searchPlaceholder")} />
        <CommandList>
          <CommandEmpty>{t("noResults")}</CommandEmpty>
          {onSourcePage ? (
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  window.dispatchEvent(new Event(OPEN_SOURCE_SEARCH_EVENT));
                }}
              >
                <FileSearch aria-hidden />
                {t("searchThisSource")}
              </CommandItem>
            </CommandGroup>
          ) : null}
          {sources.length > 0 ? (
            <CommandGroup heading={t("sourcesHeading")}>
              {sources.map((source) => {
                const Icon = providerIcon(source.provider);
                return (
                  <CommandItem
                    key={source.id}
                    value={`${source.name} ${source.bucket}`}
                    onSelect={() => {
                      setOpen(false);
                      router.push(`/source/${source.id}`);
                    }}
                  >
                    <Icon aria-hidden />
                    <span className="truncate">{source.name}</span>
                    <span className="ml-auto truncate text-xs text-muted-foreground">
                      {source.bucket}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}
          {canManage ? (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("administrationHeading")}>
                <CommandItem onSelect={() => go("/admin/sources")}>
                  <Plus aria-hidden />
                  {t("addSource")}
                </CommandItem>
                <CommandItem onSelect={() => go("/admin/users")}>
                  <Settings2 aria-hidden />
                  {t("openAdmin")}
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
