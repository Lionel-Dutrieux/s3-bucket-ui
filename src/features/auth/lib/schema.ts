import { z } from "zod";

export const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(100, "Name is too long."),
  email: z.email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "At least 8 characters.")
    .max(128, "Password is too long."),
});
export type SignUpValues = z.infer<typeof signUpSchema>;
