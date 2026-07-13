"use client";

import { useFieldContext } from "@/forms/context";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface SwitchFieldProps {
  label: string;
  /** One line under the label saying what turning it on does. */
  description?: string;
}

export function SwitchField({ label, description }: SwitchFieldProps) {
  const field = useFieldContext<boolean>();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={field.name}>{label}</Label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Switch
        id={field.name}
        name={field.name}
        checked={field.state.value}
        onCheckedChange={(checked) => field.handleChange(checked)}
        onBlur={field.handleBlur}
      />
    </div>
  );
}
