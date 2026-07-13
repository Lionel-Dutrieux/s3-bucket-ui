import {
  FolderPlus,
  Pencil,
  Trash2,
  Upload,
  type LucideIcon,
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
};

export function operationLabel(action: string): OperationLabel {
  return LABELS[action] ?? { label: action, icon: Pencil };
}
