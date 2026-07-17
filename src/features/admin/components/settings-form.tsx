"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  setOidcOnlyEnabled,
  setPublicSharing,
  setSignUpEnabled,
} from "@/features/admin/actions";
import type { ActionResult } from "@/lib/action-result";

export function SettingsForm({
  signUpEnabled,
  oidcOnly,
  oidcConfigured,
  sharingEnabled,
}: {
  signUpEnabled: boolean;
  oidcOnly: boolean;
  oidcConfigured: boolean;
  sharingEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations("admin.settingsForm");

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
        title={t("signUpTitle")}
        description={t("signUpDescription")}
        checked={signUpEnabled}
        disabled={pending}
        onChange={(enabled) =>
          run(
            () => setSignUpEnabled(enabled),
            enabled ? t("signUpEnabledToast") : t("signUpDisabledToast"),
          )
        }
      />
      <SettingRow
        title={t("oidcOnlyTitle")}
        description={
          oidcConfigured
            ? t("oidcOnlyDescriptionConfigured")
            : t("oidcOnlyDescriptionUnconfigured")
        }
        checked={oidcOnly}
        disabled={pending || (!oidcConfigured && !oidcOnly)}
        onChange={(enabled) =>
          run(
            () => setOidcOnlyEnabled(enabled),
            enabled ? t("oidcOnlyEnabledToast") : t("oidcOnlyDisabledToast"),
          )
        }
      />
      <SettingRow
        title={t("sharingTitle")}
        description={t("sharingDescription")}
        checked={sharingEnabled}
        disabled={pending}
        onChange={(enabled) =>
          run(
            () => setPublicSharing(enabled),
            enabled ? t("sharingEnabledToast") : t("sharingDisabledToast"),
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
