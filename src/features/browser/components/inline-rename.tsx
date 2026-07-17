"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { renameFolder, renameObject } from "@/features/browser/actions/entries";
import type { BrowserEntry } from "@/features/browser/lib/entries";
import { splitFileName } from "@/features/browser/lib/file-name";
import { entryNameSchema } from "@/features/browser/lib/schemas";
import { cn } from "@/lib/utils";

/**
 * In-place rename (Drive-style): Enter commits, Escape or clicking away
 * cancels. Replaces the name text right where it sits, so there is no
 * dialog to open for a one-field edit.
 *
 * For files the extension is a fixed suffix outside the editable field —
 * whatever is typed or selected, the rename keeps it. Extensionless names,
 * dotfiles and folders edit as one piece.
 */
export function InlineRenameInput({
  sourceId,
  entry,
  onEnd,
  className,
}: {
  sourceId: string;
  entry: BrowserEntry;
  /** Called once the edit ends; true when a rename actually happened. */
  onEnd: (renamed: boolean) => void;
  className?: string;
}) {
  const t = useTranslations("browser.inlineRename");
  const { stem, ext } =
    entry.kind === "file"
      ? splitFileName(entry.name)
      : { stem: entry.name, ext: "" };
  const [name, setName] = useState(stem);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (pending) return;
    const trimmed = name.trim() === "" ? "" : `${name.trim()}${ext}`;
    if (trimmed === "" || trimmed === entry.name) {
      onEnd(false);
      return;
    }
    const parsed = entryNameSchema.safeParse(trimmed);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("invalidName"));
      return;
    }
    setPending(true);
    const result =
      entry.kind === "folder"
        ? await renameFolder(sourceId, entry.prefix, trimmed)
        : await renameObject(sourceId, entry.key, trimmed);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("renamedToast", { name: trimmed }));
    onEnd(true);
  };

  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2", className)}>
      <div className="flex h-7 w-full min-w-0 flex-1 items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            // The row/table must not react to keys typed into the field.
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onEnd(false);
            }
          }}
          onBlur={() => {
            if (!pending) onEnd(false);
          }}
          // The overlay link / drag sensor sit under the input.
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          ref={(input) => {
            if (!input || document.activeElement === input) return;
            input.focus();
            input.select();
          }}
          disabled={pending}
          aria-label={
            ext
              ? t("ariaWithExt", { name: entry.name, ext })
              : t("ariaPlain", { name: entry.name })
          }
          className="h-full w-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
        />
        {ext ? (
          <span
            className="pr-2 text-sm text-muted-foreground select-none"
            // Clicking the suffix must not blur the input (blur cancels).
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {ext}
          </span>
        ) : null}
      </div>
      {pending ? (
        <Loader2
          className="size-4 shrink-0 animate-spin text-muted-foreground"
          aria-label={t("renaming")}
        />
      ) : null}
    </div>
  );
}
