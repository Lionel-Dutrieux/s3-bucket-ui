import { z } from "zod";

export const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
export type SignInValues = z.infer<typeof signInSchema>;

const passwordSchema = z
  .string()
  .min(8, "At least 8 characters.")
  .max(128, "Password is too long.");

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address."),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(100, "Name is too long."),
});
export type ProfileValues = z.infer<typeof profileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(100, "Name is too long."),
  email: z.email("Enter a valid email address."),
  password: passwordSchema,
});
export type SignUpValues = z.infer<typeof signUpSchema>;

export const twoFactorChallengeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, "Enter the 6-digit code.")
    .max(11, "Code is too long."),
  trustDevice: z.boolean(),
});
export type TwoFactorChallengeValues = z.infer<typeof twoFactorChallengeSchema>;
