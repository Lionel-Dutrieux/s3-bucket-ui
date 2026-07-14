"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setOidcOnlyEnabled, setSignUpEnabled } from "@/features/admin/actions";
import type { ActionResult } from "@/lib/action-result";

export function SettingsForm({
  signUpEnabled,
  oidcOnly,
  oidcConfigured,
}: {
  signUpEnabled: boolean;
  oidcOnly: boolean;
  oidcConfigured: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (work: () => Promise<ActionResult>, success: string) => {
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  };

  return (
    <div className="divide-y rounded-xl border bg-card shadow-sm">
      <SettingRow
        title="Public sign-up"
        description="Let anyone with the URL create an email/password account. New accounts still see nothing until you grant them sources. Off by default — accounts are then created from the Users tab. OIDC sign-in is not affected: your identity provider decides who can use it."
        checked={signUpEnabled}
        disabled={pending}
        onChange={(enabled) =>
          run(
            () => setSignUpEnabled(enabled),
            enabled ? "Public sign-up enabled" : "Public sign-up disabled",
          )
        }
      />
      <SettingRow
        title="OIDC only"
        description={
          oidcConfigured
            ? "Disable every email/password entry point (sign-in, sign-up, password reset and change) — the SSO provider becomes the only way in. If the provider goes down, so does sign-in: keep an admin session open when testing."
            : "Disable email/password sign-in entirely. Requires an OIDC provider (OIDC_* environment variables) — configure one first."
        }
        checked={oidcOnly}
        disabled={pending || (!oidcConfigured && !oidcOnly)}
        onChange={(enabled) =>
          run(
            () => setOidcOnlyEnabled(enabled),
            enabled ? "OIDC-only mode enabled" : "OIDC-only mode disabled",
          )
        }
      />
    </div>
  );
}

function SettingRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={title}
      />
    </div>
  );
}
