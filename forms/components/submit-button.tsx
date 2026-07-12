"use client";

import { useStore } from "@tanstack/react-form";
import { Loader2Icon } from "lucide-react";
import { useFormContext } from "@/forms/context";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  children: React.ReactNode;
  /** Label swapped in while the form is submitting, e.g. "Signing in…" */
  pendingLabel?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  className,
}: SubmitButtonProps) {
  const form = useFormContext();
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Button type="submit" disabled={disabled || isSubmitting} className={className}>
      {isSubmitting ? (
        <>
          <Loader2Icon className="animate-spin" aria-hidden />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
