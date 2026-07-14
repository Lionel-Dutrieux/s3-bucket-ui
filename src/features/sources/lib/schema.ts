import { z } from "zod";
import { getProvider } from "@/lib/storage/providers";

// Single source of truth for source validation: the add-source form validates
// against it on the client (TanStack Form standard-schema support) and the
// server actions re-parse raw input with it before touching storage.
export const sourceInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  provider: z
    .string()
    .refine((id) => getProvider(id) !== undefined, "Unknown provider."),
  endpoint: z
    .string()
    .trim()
    .min(1, "Endpoint is required.")
    .refine((value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, "Must be a valid https:// URL.")
    // Normalize to the origin (drops trailing slashes and any path).
    .transform((value) => new URL(value).origin),
  bucket: z.string().trim().min(1, "Bucket is required."),
  accessKeyId: z.string().trim().min(1, "Access key is required."),
  secretAccessKey: z.string().trim().min(1, "Secret is required."),
  // Write permissions are opt-in — a source is read-only by default.
  allowUpload: z.boolean(),
  allowDelete: z.boolean(),
});

// Editing an existing source: a blank secret means "keep the stored one",
// so the min(1) requirement is lifted — everything else validates the same.
export const sourceUpdateSchema = sourceInputSchema.extend({
  secretAccessKey: z.string().trim(),
});

/** Raw form values (before parsing/normalization). */
export type SourceFormValues = z.input<typeof sourceInputSchema>;
