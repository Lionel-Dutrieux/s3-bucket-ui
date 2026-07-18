import { z } from "zod";
import { getProvider, normalizeEndpoint } from "@/lib/storage/providers";

// Single source of truth for source validation: the add-source form validates
// against it on the client (TanStack Form standard-schema support) and the
// server actions re-parse raw input with it before touching storage.
//
// Which fields are required depends on the provider: object stores and
// protocol servers need an endpoint + credentials, local (fs) sources only a
// root path — so requirements live in an object-level superRefine rather
// than per-field rules, and the transform blanks whatever a provider
// ignores. The LOCAL_FS_ROOTS allowlist check is server-only and happens in
// the actions, not here.
const baseSourceSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  provider: z
    .string()
    .refine((id) => getProvider(id) !== undefined, "Unknown provider."),
  endpoint: z.string().trim(),
  bucket: z.string().trim().min(1, "Bucket is required."),
  accessKeyId: z.string().trim(),
  secretAccessKey: z.string().trim(),
  // Whether public share links may be minted for this source (default on).
  allowPublicShares: z.boolean(),
});

type BaseValues = z.infer<typeof baseSourceSchema>;

function isLocal(values: BaseValues): boolean {
  return getProvider(values.provider)?.adapter === "fs";
}

function withProviderRules<Schema extends typeof baseSourceSchema>(
  schema: Schema,
  { requireSecret }: { requireSecret: boolean },
) {
  return schema
    .superRefine((values, ctx) => {
      if (isLocal(values)) return; // root path (bucket) is the only field
      if (!values.endpoint) {
        ctx.addIssue({
          code: "custom",
          path: ["endpoint"],
          message: "Endpoint is required.",
        });
      } else {
        const checked = normalizeEndpoint(values.provider, values.endpoint);
        if (!checked.ok) {
          ctx.addIssue({
            code: "custom",
            path: ["endpoint"],
            message: checked.message,
          });
        }
      }
      if (!values.accessKeyId) {
        ctx.addIssue({
          code: "custom",
          path: ["accessKeyId"],
          message: "Access key is required.",
        });
      }
      if (requireSecret && !values.secretAccessKey) {
        ctx.addIssue({
          code: "custom",
          path: ["secretAccessKey"],
          message: "Secret is required.",
        });
      }
    })
    .transform((values) => {
      if (isLocal(values)) {
        // A provider switch mid-form can leave stray values behind; a local
        // source stores none of them.
        return { ...values, endpoint: "", accessKeyId: "", secretAccessKey: "" };
      }
      const checked = normalizeEndpoint(values.provider, values.endpoint);
      return checked.ok ? { ...values, endpoint: checked.value } : values;
    });
}

export const sourceInputSchema = withProviderRules(baseSourceSchema, {
  requireSecret: true,
});

// Editing an existing source: a blank secret means "keep the stored one".
export const sourceUpdateSchema = withProviderRules(baseSourceSchema, {
  requireSecret: false,
});

/** Raw form values (before parsing/normalization). */
export type SourceFormValues = z.input<typeof sourceInputSchema>;
