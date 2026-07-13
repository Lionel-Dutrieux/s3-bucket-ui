import { createFormHook } from "@tanstack/react-form";
import { SubmitButton } from "@/forms/components/submit-button";
import { fieldContext, formContext } from "@/forms/context";
import { SelectField } from "@/forms/fields/select-field";
import { SwitchField } from "@/forms/fields/switch-field";
import { TextField } from "@/forms/fields/text-field";

// App-wide form hook: every form gets the same field/form components,
// fully typed. Add new reusable fields in forms/fields/ and register them here.
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    SelectField,
    SwitchField,
  },
  formComponents: {
    SubmitButton,
  },
});
