import { z } from "zod";
import { getProvider, normalizeEndpoint } from "@/lib/storage/providers";

// Single source of truth for source validation: the add-source form validates
// against it on the client (TanStack Form standard-schema support) and the
// server actions re-parse raw input with it before touching storage.
//
// The endpoint rule depends on the provider (https origin for object stores,
// sftp:// or ftp(s):// for protocol sources, http(s) URL with its path kept
// for WebDAV), so it's an object-level refinement + transform rather than a
// field rule.
const baseSourceSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  provider: z
    .string()
    .refine((id) => getProvider(id) !== undefined, "Unknown provider."),
  endpoint: z.string().trim().min(1, "Endpoint is required."),
  bucket: z.string().trim().min(1, "Bucket is required."),
  accessKeyId: z.string().trim().min(1, "Access key is required."),
  secretAccessKey: z.string().trim().min(1, "Secret is required."),
  // Whether public share links may be minted for this source (default on).
  allowPublicShares: z.boolean(),
});

function withEndpointRule<Schema extends typeof baseSourceSchema>(
  schema: Schema,
) {
  return schema
    .superRefine((values, ctx) => {
      const checked = normalizeEndpoint(values.provider, values.endpoint);
      if (!checked.ok) {
        ctx.addIssue({
          code: "custom",
          path: ["endpoint"],
          message: checked.message,
        });
      }
    })
    .transform((values) => {
      const checked = normalizeEndpoint(values.provider, values.endpoint);
      return checked.ok ? { ...values, endpoint: checked.value } : values;
    });
}

export const sourceInputSchema = withEndpointRule(baseSourceSchema);

// Editing an existing source: a blank secret means "keep the stored one",
// so the min(1) requirement is lifted — everything else validates the same.
export const sourceUpdateSchema = withEndpointRule(
  baseSourceSchema.extend({
    secretAccessKey: z.string().trim(),
  }),
);

/** Raw form values (before parsing/normalization). */
export type SourceFormValues = z.input<typeof sourceInputSchema>;
