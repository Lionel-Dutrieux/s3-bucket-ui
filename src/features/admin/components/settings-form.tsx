"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setSignUpEnabled } from "@/features/admin/actions";

export function SettingsForm({ signUpEnabled }: { signUpEnabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const toggle = (enabled: boolean) => {
    startTransition(async () => {
      const result = await setSignUpEnabled(enabled);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        enabled ? "Public sign-up enabled" : "Public sign-up disabled",
      );
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Public sign-up</p>
          <p className="max-w-prose text-sm text-muted-foreground">
            Let anyone with the URL create an email/password account. New
            accounts still see nothing until you grant them sources. Off by
            default — accounts are then created from the Users tab. Sign-in
            through the OIDC provider is not affected: your identity provider
            decides who can use it.
          </p>
        </div>
        <Switch
          checked={signUpEnabled}
          disabled={pending}
          onCheckedChange={toggle}
          aria-label="Allow public sign-up"
        />
      </div>
    </div>
  );
}
