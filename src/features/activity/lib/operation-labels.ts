import {
  ArrowRightLeft,
  Copy,
  FolderInput,
  FolderPlus,
  Link2,
  Link2Off,
  type LucideIcon,
  Pencil,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";

/** Every key that exists under the `activity.operations` message namespace. */
export type OperationLabelKey =
  | "upload"
  | "createFolder"
  | "delete"
  | "deleteFolder"
  | "deleteMany"
  | "rename"
  | "renameFolder"
  | "move"
  | "moveTo"
  | "copy"
  | "copyTo"
  | "migrate"
  | "shareCreate"
  | "shareRevoke"
  | "signInFailed";

// Presentation for each audited action. `destructive` tints the icon so a
// delete reads differently from an upload at a glance. `labelKey` resolves
// against the `activity.operations` message namespace at render time — this
// module is pure and never touches next-intl.
interface OperationLabel {
  labelKey: OperationLabelKey | null;
  icon: LucideIcon;
  destructive?: boolean;
}

const LABELS: Record<string, OperationLabel> = {
  upload: { labelKey: "upload", icon: Upload },
  "create-folder": { labelKey: "createFolder", icon: FolderPlus },
  delete: { labelKey: "delete", icon: Trash2, destructive: true },
  "delete-folder": {
    labelKey: "deleteFolder",
    icon: Trash2,
    destructive: true,
  },
  "delete-many": { labelKey: "deleteMany", icon: Trash2, destructive: true },
  rename: { labelKey: "rename", icon: Pencil },
  "rename-folder": { labelKey: "renameFolder", icon: Pencil },
  move: { labelKey: "move", icon: FolderInput },
  "move-to": { labelKey: "moveTo", icon: FolderInput },
  copy: { labelKey: "copy", icon: Copy },
  "copy-to": { labelKey: "copyTo", icon: Copy },
  migrate: { labelKey: "migrate", icon: ArrowRightLeft },
  "share-create": { labelKey: "shareCreate", icon: Link2 },
  "share-revoke": { labelKey: "shareRevoke", icon: Link2Off },
  "sign-in-failed": {
    labelKey: "signInFailed",
    icon: ShieldAlert,
    destructive: true,
  },
};

/**
 * Resolves the presentation for an audited action. `labelKey` is `null` for
 * unknown actions — callers should fall back to the raw action string
 * instead of resolving it through `t()`.
 */
export function operationLabel(action: string): OperationLabel {
  return LABELS[action] ?? { labelKey: null, icon: Pencil };
}

/** Every known action with its message key — drives the activity filter. */
export const OPERATION_FILTERS: { id: string; labelKey: OperationLabelKey }[] =
  Object.entries(LABELS).map(([id, { labelKey }]) => ({
    id,
    // Every LABELS entry has a real key — only the operationLabel() fallback
    // for unrecognized actions returns null.
    labelKey: labelKey as OperationLabelKey,
  }));
