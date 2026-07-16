import { z } from "zod";

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Group name is required.")
  .max(64, "Group name is too long.");

// Shape of the create-group form — one named field so the form kit can
// validate it like every other form.
export const createGroupSchema = z.object({ name: groupNameSchema });
export type CreateGroupValues = z.infer<typeof createGroupSchema>;

export const roleSchema = z.enum(["user", "admin"]);
export type Role = z.infer<typeof roleSchema>;

// Admin-created accounts (Admin → Users → Create user).
export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100, "Name is too long."),
  email: z.email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "At least 8 characters.")
    .max(128, "Password is too long."),
  role: roleSchema,
});
export type CreateUserValues = z.infer<typeof createUserSchema>;

export const grantSubjectSchema = z.object({
  type: z.enum(["user", "group"]),
  id: z.string().min(1),
});

export const grantInputSchema = z.object({
  sourceId: z.uuid(),
  subject: grantSubjectSchema,
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});
export type GrantInputValues = z.infer<typeof grantInputSchema>;

// --- branding (white labelling) ---

export const BRANDING_LOGO_MAX_BYTES = 512 * 1024;

const LOGO_DATA_URL =
  /^data:image\/(svg\+xml|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Decoded size of a base64 data-URL payload, in bytes. */
function dataUrlBytes(dataUrl: string): number {
  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return (payload.length * 3) / 4 - padding;
}

export const brandingSchema = z.object({
  appName: z
    .string()
    .trim()
    .min(1, "App name is required.")
    .max(64, "Keep the app name under 64 characters."),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB hex color.")
    .nullable(),
  // undefined → keep the current logo, null → remove it, string → replace it.
  logo: z
    .string()
    .regex(LOGO_DATA_URL, "The logo must be an SVG, PNG or WebP image.")
    .refine(
      (value) => dataUrlBytes(value) <= BRANDING_LOGO_MAX_BYTES,
      "The logo must be 512 KB or smaller.",
    )
    .nullish(),
});

export type BrandingValues = z.infer<typeof brandingSchema>;
