"use client";

import {
  Copy,
  Download,
  Eye,
  FolderDown,
  FolderInput,
  Info,
  type LucideIcon,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadUrl, zipUrl } from "@/features/browser/api/client";
import type { BrowserEntry } from "@/features/browser/lib/entries";
import type { FileEntry, FolderEntry } from "@/features/browser/lib/listing";
import { isPreviewable } from "@/features/browser/lib/preview-kind";
import { cn } from "@/lib/utils";

/** The callbacks an entry menu can offer — absent ones hide the action. */
export interface EntryActionHandlers {
  sourceId: string;
  onPreview?: (file: FileEntry) => void;
  onShare?: (file: FileEntry) => void;
  /** Share a whole folder as one public link — absent hides the action. */
  onShareFolder?: (folder: FolderEntry) => void;
  onDetails?: (file: FileEntry) => void;
  onDelete?: (entry: BrowserEntry) => void;
  onRename?: (entry: BrowserEntry) => void;
  onDuplicate?: (file: FileEntry) => void;
  onMove?: (entry: BrowserEntry) => void;
}

interface EntryAction {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Plain navigation (download/zip) — rendered as a link. */
  href?: string;
  run?: () => void;
  destructive?: boolean;
  separatorBefore?: boolean;
}

type EntryActionsT = ReturnType<typeof useTranslations>;

/** One list of actions drives both the kebab menu and the context menu. */
function entryActions(
  entry: BrowserEntry,
  handlers: EntryActionHandlers,
  t: EntryActionsT,
): EntryAction[] {
  const {
    sourceId,
    onPreview,
    onShare,
    onShareFolder,
    onDetails,
    onDelete,
    onRename,
    onDuplicate,
    onMove,
  } = handlers;

  if (entry.kind === "folder") {
    const actions: EntryAction[] = [
      {
        key: "zip",
        label: t("downloadZip"),
        icon: FolderDown,
        href: zipUrl(sourceId, entry.prefix),
      },
    ];
    if (onShareFolder) {
      actions.push({
        key: "share",
        label: t("share"),
        icon: Share2,
        run: () => onShareFolder(entry),
      });
    }
    if (onMove) {
      actions.push({
        key: "move",
        label: t("moveTo"),
        icon: FolderInput,
        run: () => onMove(entry),
      });
    }
    if (onRename) {
      actions.push({
        key: "rename",
        label: t("rename"),
        icon: Pencil,
        run: () => onRename(entry),
      });
    }
    if (onDelete) {
      actions.push({
        key: "delete",
        label: t("deleteFolder"),
        icon: Trash2,
        run: () => onDelete(entry),
        destructive: true,
        separatorBefore: true,
      });
    }
    return actions;
  }

  const actions: EntryAction[] = [];
  if (onPreview && isPreviewable(entry.name)) {
    actions.push({
      key: "preview",
      label: t("preview"),
      icon: Eye,
      run: () => onPreview(entry),
    });
  }
  if (onDetails) {
    actions.push({
      key: "details",
      label: t("details"),
      icon: Info,
      run: () => onDetails(entry),
    });
  }
  actions.push({
    key: "download",
    label: t("download"),
    icon: Download,
    href: downloadUrl(sourceId, entry.key),
  });
  if (onShare) {
    actions.push({
      key: "share",
      label: t("share"),
      icon: Share2,
      run: () => onShare(entry),
    });
  }
  if (onDuplicate) {
    actions.push({
      key: "duplicate",
      label: t("duplicate"),
      icon: Copy,
      run: () => onDuplicate(entry),
    });
  }
  if (onMove) {
    actions.push({
      key: "move",
      label: t("moveTo"),
      icon: FolderInput,
      run: () => onMove(entry),
    });
  }
  if (onRename) {
    actions.push({
      key: "rename",
      label: t("rename"),
      icon: Pencil,
      run: () => onRename(entry),
    });
  }
  if (onDelete) {
    actions.push({
      key: "delete",
      label: t("delete"),
      icon: Trash2,
      run: () => onDelete(entry),
      destructive: true,
      separatorBefore: true,
    });
  }
  return actions;
}

interface MenuItemProps {
  asChild?: boolean;
  variant?: "destructive" | "default";
  onSelect?: (event: Event) => void;
  children?: React.ReactNode;
}

/** Renders the action list with either menu's primitives — the kebab and the
 * context menu share everything but the Item/Separator components. */
function ActionItems({
  actions,
  Item,
  Separator,
}: {
  actions: EntryAction[];
  Item: React.ComponentType<MenuItemProps>;
  Separator: React.ComponentType;
}) {
  return actions.map((action) => (
    <div key={action.key} className="contents">
      {action.separatorBefore ? <Separator /> : null}
      {action.href ? (
        <Item asChild>
          <a href={action.href}>
            <action.icon aria-hidden />
            {action.label}
          </a>
        </Item>
      ) : (
        <Item
          variant={action.destructive ? "destructive" : "default"}
          onSelect={action.run}
        >
          <action.icon aria-hidden />
          {action.label}
        </Item>
      )}
    </div>
  ));
}

/** Kebab (⋮) menu holding every action available on the entry. */
export function EntryActionsMenu({
  entry,
  handlers,
  className,
}: {
  entry: BrowserEntry;
  handlers: EntryActionHandlers;
  className?: string;
}) {
  const t = useTranslations("browser.entryActions");
  const actions = entryActions(entry, handlers, t);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground data-open:bg-muted data-open:text-foreground",
          className,
        )}
        aria-label={t("actionsFor", { name: entry.name })}
        title={t("moreActions")}
        // Keep the row/card drag sensor from swallowing the click.
        onPointerDown={(event) => event.stopPropagation()}
      >
        <MoreVertical className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <ActionItems
          actions={actions}
          Item={DropdownMenuItem}
          Separator={DropdownMenuSeparator}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Right-click menu with the same actions; wraps a row or card. */
export function EntryContextMenu({
  entry,
  handlers,
  children,
}: {
  entry: BrowserEntry;
  handlers: EntryActionHandlers;
  children: React.ReactNode;
}) {
  const t = useTranslations("browser.entryActions");
  const actions = entryActions(entry, handlers, t);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ActionItems
          actions={actions}
          Item={ContextMenuItem}
          Separator={ContextMenuSeparator}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}
