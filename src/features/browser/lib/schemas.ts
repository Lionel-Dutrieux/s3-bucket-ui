import { z } from "zod";

// Validation for user-typed entry names, shared by the dialogs (field-level
// feedback) and the server actions (the real gate — client checks are
// cosmetic). Trimming happens here so both sides agree on the final name.

export const entryNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .refine((name) => !name.includes("/"), "Names can't contain “/”.");

export const folderNameSchema = z
  .string()
  .trim()
  .min(1, "Folder name is required.")
  .refine((name) => !name.includes("/"), "Folder names can't contain “/”.");
