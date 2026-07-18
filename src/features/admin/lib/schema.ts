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
  /^data:image\/(svg\+xml|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/;

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

// --- share policy (org-wide) ---

// Discrete lifetime caps offered in Admin → Settings; 0 = no cap (unlimited).
export const SHARE_MAX_EXPIRY_OPTIONS = [0, 1, 7, 30, 90, 365] as const;

export const sharePolicySchema = z.object({
  // 0 means "no cap"; the DAL stores null for it.
  maxExpiryDays: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(7),
    z.literal(30),
    z.literal(90),
    z.literal(365),
  ]),
  requirePassword: z.boolean(),
});
export type SharePolicyValues = z.infer<typeof sharePolicySchema>;

// --- runtime config (SMTP / OIDC) ---

export const smtpSettingsSchema = z.object({
  host: z.string().trim().min(1, "SMTP host is required.").max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().trim().max(255).nullable(),
  // null → keep the currently stored secret (write-only field).
  password: z.string().min(1).max(1024).nullable(),
  from: z.string().trim().min(3, "Sender address is required.").max(320),
});
export type SmtpSettingsValues = z.infer<typeof smtpSettingsSchema>;

export const oidcSettingsSchema = z.object({
  discoveryUrl: z
    .url("Enter the full discovery URL.")
    .startsWith("https://", "The discovery URL must use https."),
  clientId: z.string().trim().min(1, "Client ID is required.").max(255),
  // null → keep the currently stored secret (write-only field).
  clientSecret: z.string().min(1).max(1024).nullable(),
  providerLabel: z.string().trim().min(1).max(64),
  scopes: z.string().trim().min(1).max(255),
  groupsClaim: z.string().trim().min(1).max(64),
});
export type OidcSettingsValues = z.infer<typeof oidcSettingsSchema>;
