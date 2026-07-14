"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxGroup {
  heading: string;
  options: ComboboxOption[];
}

/**
 * Type-to-search picker for admin flows (grants, group members): a button
 * opening a cmdk list. Selecting an entry fires `onSelect` immediately and
 * closes — pickers here always mean "add this one".
 */
export function SearchCombobox({
  label,
  searchPlaceholder,
  emptyMessage,
  groups,
  onSelect,
  disabled,
}: {
  label: string;
  searchPlaceholder: string;
  emptyMessage: string;
  groups: ComboboxGroup[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasOptions = groups.some((group) => group.options.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !hasOptions}
          aria-expanded={open}
        >
          <Plus aria-hidden />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {groups.map((group) =>
              group.options.length > 0 ? (
                <CommandGroup key={group.heading} heading={group.heading}>
                  {group.options.map((option) => (
                    <CommandItem
                      key={option.value}
                      // cmdk filters on this string (the label) — the id is
                      // appended only to keep values unique across groups.
                      value={`${option.label}::${option.value}`}
                      onSelect={() => {
                        setOpen(false);
                        onSelect(option.value);
                      }}
                    >
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null,
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
