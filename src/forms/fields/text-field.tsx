"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFieldContext } from "@/forms/context";
import { fieldErrors } from "@/forms/utils";
import { cn } from "@/lib/utils";

interface TextFieldProps {
  label: string;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  /** Render the value in monospace — for endpoints, keys, bucket names. */
  mono?: boolean;
}

export function TextField({
  label,
  type,
  placeholder,
  autoComplete,
  autoFocus,
  mono,
}: TextFieldProps) {
  const field = useFieldContext<string>();
  const showError = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        spellCheck={false}
        className={cn(mono && "font-mono text-sm")}
        aria-invalid={showError}
      />
      {showError ? (
        <p className="text-sm text-destructive">
          {fieldErrors(field).join(" ")}
        </p>
      ) : null}
    </div>
  );
}
