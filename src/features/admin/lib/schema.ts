import { z } from "zod";

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Group name is required.")
  .max(64, "Group name is too long.");

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
