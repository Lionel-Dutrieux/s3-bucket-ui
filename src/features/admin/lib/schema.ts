import { z } from "zod";

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Group name is required.")
  .max(64, "Group name is too long.");

export const roleSchema = z.enum(["user", "admin"]);
export type Role = z.infer<typeof roleSchema>;

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
