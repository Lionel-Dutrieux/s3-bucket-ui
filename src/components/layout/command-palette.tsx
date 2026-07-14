"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { AddSourceDialog } from "@/features/sources/components/add-source-dialog";
import { providerIcon } from "@/features/sources/components/provider-icons";
import type { SourceSummary } from "@/lib/dal/sources";

/** Ctrl/Cmd+K palette: jump to a source, or add one (admins). */
export function CommandPalette({
  sources,
  canManage,
}: {
  sources: SourceSummary[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command palette"
        description="Jump to a source or add a new one"
      >
        {/* This CommandDialog doesn't wrap children in <Command> itself. */}
        <Command>
          <CommandInput placeholder="Search sources…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            {sources.length > 0 ? (
              <CommandGroup heading="Sources">
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
                      <span className="ml-auto truncate font-mono text-xs text-muted-foreground">
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
                <CommandGroup heading="Actions">
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      setAddOpen(true);
                    }}
                  >
                    <Plus aria-hidden />
                    Add source
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>

      {canManage ? (
        <AddSourceDialog open={addOpen} onOpenChange={setAddOpen} />
      ) : null}
    </>
  );
}
