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
import type { FileEntry } from "@/features/browser/lib/listing";
import { isPreviewable } from "@/features/browser/lib/preview-kind";
import { cn } from "@/lib/utils";

/** The callbacks an entry menu can offer — absent ones hide the action. */
export interface EntryActionHandlers {
  sourceId: string;
  onPreview?: (file: FileEntry) => void;
  onShare?: (file: FileEntry) => void;
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

/** One list of actions drives both the kebab menu and the context menu. */
function entryActions(
  entry: BrowserEntry,
  handlers: EntryActionHandlers,
): EntryAction[] {
  const {
    sourceId,
    onPreview,
    onShare,
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
        label: "Download as ZIP",
        icon: FolderDown,
        href: zipUrl(sourceId, entry.prefix),
      },
    ];
    if (onMove) {
      actions.push({
        key: "move",
        label: "Move to…",
        icon: FolderInput,
        run: () => onMove(entry),
      });
    }
    if (onRename) {
      actions.push({
        key: "rename",
        label: "Rename",
        icon: Pencil,
        run: () => onRename(entry),
      });
    }
    if (onDelete) {
      actions.push({
        key: "delete",
        label: "Delete folder",
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
      label: "Preview",
      icon: Eye,
      run: () => onPreview(entry),
    });
  }
  if (onDetails) {
    actions.push({
      key: "details",
      label: "Details",
      icon: Info,
      run: () => onDetails(entry),
    });
  }
  actions.push({
    key: "download",
    label: "Download",
    icon: Download,
    href: downloadUrl(sourceId, entry.key),
  });
  if (onShare) {
    actions.push({
      key: "share",
      label: "Share",
      icon: Share2,
      run: () => onShare(entry),
    });
  }
  if (onDuplicate) {
    actions.push({
      key: "duplicate",
      label: "Duplicate",
      icon: Copy,
      run: () => onDuplicate(entry),
    });
  }
  if (onMove) {
    actions.push({
      key: "move",
      label: "Move to…",
      icon: FolderInput,
      run: () => onMove(entry),
    });
  }
  if (onRename) {
    actions.push({
      key: "rename",
      label: "Rename",
      icon: Pencil,
      run: () => onRename(entry),
    });
  }
  if (onDelete) {
    actions.push({
      key: "delete",
      label: "Delete",
      icon: Trash2,
      run: () => onDelete(entry),
      destructive: true,
      separatorBefore: true,
    });
  }
  return actions;
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
  const actions = entryActions(entry, handlers);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground data-open:bg-muted data-open:text-foreground",
          className,
        )}
        aria-label={`Actions for ${entry.name}`}
        title="More actions"
        // Keep the row/card drag sensor from swallowing the click.
        onPointerDown={(event) => event.stopPropagation()}
      >
        <MoreVertical className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {actions.map((action) => (
          <div key={action.key} className="contents">
            {action.separatorBefore ? <DropdownMenuSeparator /> : null}
            {action.href ? (
              <DropdownMenuItem asChild>
                <a href={action.href}>
                  <action.icon aria-hidden />
                  {action.label}
                </a>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant={action.destructive ? "destructive" : "default"}
                onSelect={action.run}
              >
                <action.icon aria-hidden />
                {action.label}
              </DropdownMenuItem>
            )}
          </div>
        ))}
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
  const actions = entryActions(entry, handlers);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        {actions.map((action) => (
          <div key={action.key} className="contents">
            {action.separatorBefore ? <ContextMenuSeparator /> : null}
            {action.href ? (
              <ContextMenuItem asChild>
                <a href={action.href}>
                  <action.icon aria-hidden />
                  {action.label}
                </a>
              </ContextMenuItem>
            ) : (
              <ContextMenuItem
                variant={action.destructive ? "destructive" : "default"}
                onSelect={action.run}
              >
                <action.icon aria-hidden />
                {action.label}
              </ContextMenuItem>
            )}
          </div>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
