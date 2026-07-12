// Composable, reusable field validation rules.
// Usage: <form.AppField name="endpoint" validators={validate(required("Endpoint"), httpsUrl())}>

export type FieldValidator = (value: string) => string | undefined;

export function required(label: string): FieldValidator {
  return (value) => (value.trim() === "" ? `${label} is required.` : undefined);
}

export function httpsUrl(): FieldValidator {
  return (value) =>
    value.trim().startsWith("https://")
      ? undefined
      : "Must be a valid https:// URL.";
}

export function minLength(label: string, min: number): FieldValidator {
  return (value) =>
    value.length < min
      ? `${label} must be at least ${min} characters.`
      : undefined;
}

/** Runs validators in order and returns the first error. */
export function validate(...validators: FieldValidator[]) {
  return {
    onChange: ({ value }: { value: string }) => {
      for (const validator of validators) {
        const error = validator(value);
        if (error) return error;
      }
      return undefined;
    },
  };
}
