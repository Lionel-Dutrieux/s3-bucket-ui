import type { AnyFieldApi } from "@tanstack/react-form";

// Field errors can be plain strings (custom validators) or standard-schema
// issues ({ message }) when a Zod schema validates the whole form.
export function fieldErrors(field: AnyFieldApi): string[] {
  return field.state.meta.errors
    .map((error: unknown) => {
      if (typeof error === "string") return error;
      if (error && typeof error === "object" && "message" in error) {
        return String((error as { message: unknown }).message);
      }
      return undefined;
    })
    .filter((message): message is string => Boolean(message));
}
