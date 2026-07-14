import { CircleCheck } from "lucide-react";

// Form-level feedback line (server errors, connection test results).
export function FormAlert({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p
        role="status"
        className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-500"
      >
        <CircleCheck className="size-4" aria-hidden />
        {success}
      </p>
    );
  }
  return null;
}
