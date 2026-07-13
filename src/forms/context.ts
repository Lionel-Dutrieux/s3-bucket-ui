import { createFormHookContexts } from "@tanstack/react-form";

// Shared contexts binding field/form components to the form instance.
// Kept separate from form.ts to avoid a circular import with the field components.
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();
