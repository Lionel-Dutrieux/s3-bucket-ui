"use client";

import { KeyRound, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

/** Starts the generic OIDC flow — rendered only when the provider is configured. */
export function OidcButton({ label }: { label: string }) {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    const { error } = await authClient.signIn.oauth2({
      providerId: "oidc",
      callbackURL: "/",
    });
    // On success the browser navigates away; only errors land here.
    if (error) {
      setPending(false);
      toast.error(error.message ?? `Could not reach ${label} — try again.`);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? (
        <Loader2Icon className="animate-spin" aria-hidden />
      ) : (
        <KeyRound aria-hidden />
      )}
      Continue with {label}
    </Button>
  );
}
