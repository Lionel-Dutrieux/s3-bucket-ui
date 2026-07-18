import { z } from "zod";

// Validation for user-typed entry names, shared by the dialogs (field-level
// feedback) and the server actions (the real gate — client checks are
// cosmetic). Trimming happens here so both sides agree on the final name.

function nameSchema(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((name) => !name.includes("/"), `${label}s can't contain “/”.`);
}

export const entryNameSchema = nameSchema("Name");

export const folderNameSchema = nameSchema("Folder name");

// Mirrors the `EntryTarget` union in lib/move.ts, with the folder invariant
// (a prefix always ends with "/") baked in — the server-side gate for a
// bulk selection passed to the delete/move actions.
export const entryTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("file"), key: z.string().min(1) }),
  z.object({
    kind: z.literal("folder"),
    prefix: z
      .string()
      .refine((value) => value.endsWith("/"), "Invalid folder."),
  }),
]);
