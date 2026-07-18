"use client";

import { KeyRound, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export interface SsoProviderOption {
  providerId: string;
  label: string;
}

/** Starts the SSO flow for one registered provider. */
export function SsoButton({
  providerId,
  label,
}: {
  providerId: string;
  label: string;
}) {
  const [pending, setPending] = useState(false);
  const t = useTranslations("auth.oidc");

  const handleClick = async () => {
    setPending(true);
    const { error } = await authClient.signIn.sso({
      providerId,
      callbackURL: "/",
    });
    // On success the browser navigates away; only errors land here.
    if (error) {
      setPending(false);
      toast.error(error.message ?? t("errorFallback", { provider: label }));
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
      {t("continueWith", { provider: label })}
    </Button>
  );
}
