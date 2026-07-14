import {
  ArrowRightLeft,
  Copy,
  FolderInput,
  FolderPlus,
  type LucideIcon,
  Pencil,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";

// Presentation for each audited action. `destructive` tints the icon so a
// delete reads differently from an upload at a glance.
interface OperationLabel {
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
}

const LABELS: Record<string, OperationLabel> = {
  upload: { label: "Uploaded", icon: Upload },
  "create-folder": { label: "Created folder", icon: FolderPlus },
  delete: { label: "Deleted", icon: Trash2, destructive: true },
  "delete-folder": { label: "Deleted folder", icon: Trash2, destructive: true },
  "delete-many": { label: "Deleted items", icon: Trash2, destructive: true },
  rename: { label: "Renamed", icon: Pencil },
  "rename-folder": { label: "Renamed folder", icon: Pencil },
  move: { label: "Moved", icon: FolderInput },
  copy: { label: "Duplicated", icon: Copy },
  "copy-to": { label: "Copied", icon: Copy },
  migrate: { label: "Copied source", icon: ArrowRightLeft },
  "sign-in-failed": {
    label: "Sign-in failed",
    icon: ShieldAlert,
    destructive: true,
  },
};

export function operationLabel(action: string): OperationLabel {
  return LABELS[action] ?? { label: action, icon: Pencil };
}

/** Every known action with its display label — drives the activity filter. */
export const OPERATION_FILTERS = Object.entries(LABELS).map(
  ([id, { label }]) => ({ id, label }),
);
