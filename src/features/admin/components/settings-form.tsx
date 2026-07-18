"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  setAuditRetention,
  setOidcOnlyEnabled,
  setPublicSharing,
  setSharePolicy,
  setSignUpEnabled,
  setTwoFactorPolicy,
} from "@/features/admin/actions/settings";
import {
  SHARE_MAX_EXPIRY_OPTIONS,
  type SharePolicyValues,
} from "@/features/admin/lib/schema";
import type { TwoFactorPolicy } from "@/lib/dal/settings";

// Stricter-than ordering — used to decide whether tightening the policy
// warrants a confirmation (affected accounts get locked out of email/
// password flows until they enroll 2FA on their next navigation).
const POLICY_RANK: Record<TwoFactorPolicy, number> = {
  off: 0,
  admins: 1,
  all: 2,
};

const AUDIT_RETENTION_LABEL_KEYS = {
  0: "auditRetentionForever",
  30: "auditRetention30",
  90: "auditRetention90",
  180: "auditRetention180",
  365: "auditRetention365",
} as const;
const AUDIT_RETENTION_OPTIONS = [0, 30, 90, 180, 365] as const;

export function SettingsForm({
  signUpEnabled,
  oidcOnly,
  oidcConfigured,
  sharingEnabled,
  sharePolicy,
  twoFactorPolicy,
  auditRetentionDays,
}: {
  signUpEnabled: boolean;
  oidcOnly: boolean;
  oidcConfigured: boolean;
  sharingEnabled: boolean;
  sharePolicy: SharePolicyValues;
  twoFactorPolicy: TwoFactorPolicy;
  auditRetentionDays: number;
}) {
  const [pending, startTransition] = useTransition();
  const [pendingPolicy, setPendingPolicy] = useState<TwoFactorPolicy | null>(
    null,
  );
  const [policy, setPolicy] = useState<SharePolicyValues>(sharePolicy);
  const router = useRouter();
  const t = useTranslations("admin.settingsForm");
  const tCommon = useTranslations("common");

  const run = (
    work: () => Promise<{ serverError?: string; validationErrors?: unknown }>,
    success: string,
  ) => {
    startTransition(async () => {
      const result = await work();
      if (result.serverError || result.validationErrors) {
        toast.error(result.serverError ?? tCommon("actionFailed"));
        return;
      }
      toast.success(success);
      router.refresh();
    });
  };

  const applyTwoFactorPolicy = (policy: TwoFactorPolicy) =>
    run(() => setTwoFactorPolicy({ policy }), t("twoFactorPolicyToast"));

  // The share policy is two controls saved as one row — merge the change onto
  // the current values and persist both together.
  const applySharePolicy = (next: SharePolicyValues) => {
    setPolicy(next);
    run(() => setSharePolicy(next), t("sharePolicyToast"));
  };

  const onTwoFactorPolicyChange = (policy: TwoFactorPolicy) => {
    if (POLICY_RANK[policy] > POLICY_RANK[twoFactorPolicy]) {
      setPendingPolicy(policy);
      return;
    }
    applyTwoFactorPolicy(policy);
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
            () => setSignUpEnabled({ enabled }),
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
            () => setOidcOnlyEnabled({ enabled }),
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
            () => setPublicSharing({ enabled }),
            enabled ? t("sharingEnabledToast") : t("sharingDisabledToast"),
          )
        }
      />
      <SettingSelectRow
        title={t("shareMaxExpiryTitle")}
        description={t("shareMaxExpiryDescription")}
        value={String(policy.maxExpiryDays)}
        disabled={pending || !sharingEnabled}
        onChange={(value) =>
          applySharePolicy({
            ...policy,
            maxExpiryDays: Number(value) as SharePolicyValues["maxExpiryDays"],
          })
        }
        options={SHARE_MAX_EXPIRY_OPTIONS.map((days) => ({
          value: String(days),
          label:
            days === 0
              ? t("shareMaxExpiryUnlimited")
              : t("shareMaxExpiryDays", { count: days }),
        }))}
      />
      <SettingRow
        title={t("shareRequirePasswordTitle")}
        description={t("shareRequirePasswordDescription")}
        checked={policy.requirePassword}
        disabled={pending || !sharingEnabled}
        onChange={(requirePassword) =>
          applySharePolicy({ ...policy, requirePassword })
        }
      />
      {!oidcOnly && (
        <SettingSelectRow
          title={t("twoFactorPolicyTitle")}
          description={t("twoFactorPolicyDescription")}
          value={twoFactorPolicy}
          disabled={pending}
          onChange={onTwoFactorPolicyChange}
          options={[
            { value: "off", label: t("twoFactorPolicyOff") },
            { value: "admins", label: t("twoFactorPolicyAdmins") },
            { value: "all", label: t("twoFactorPolicyAll") },
          ]}
        />
      )}
      <SettingSelectRow
        title={t("auditRetentionTitle")}
        description={t("auditRetentionDescription")}
        value={String(auditRetentionDays)}
        disabled={pending}
        onChange={(value) =>
          run(
            () =>
              setAuditRetention({
                days: Number(value) as 0 | 30 | 90 | 180 | 365,
              }),
            t("auditRetentionToast"),
          )
        }
        options={AUDIT_RETENTION_OPTIONS.map((days) => ({
          value: String(days),
          label: t(AUDIT_RETENTION_LABEL_KEYS[days]),
        }))}
      />
      <ConfirmDialog
        open={pendingPolicy !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPolicy(null);
        }}
        title={t("twoFactorPolicyConfirmTitle")}
        description={t("twoFactorPolicyConfirmDescription")}
        confirmLabel={tCommon("confirm")}
        destructive={false}
        pending={pending}
        onConfirm={() => {
          if (pendingPolicy === null) return;
          applyTwoFactorPolicy(pendingPolicy);
          setPendingPolicy(null);
        }}
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

function SettingSelectRow<Value extends string>({
  title,
  description,
  value,
  disabled,
  onChange,
  options,
}: {
  title: string;
  description: string;
  value: Value;
  disabled: boolean;
  onChange: (value: Value) => void;
  options: { value: Value; label: string }[];
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(next as Value)}
      >
        <SelectTrigger aria-label={title}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
