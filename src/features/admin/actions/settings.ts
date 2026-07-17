"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  type OidcSettingsValues,
  oidcSettingsSchema,
  type SmtpSettingsValues,
  smtpSettingsSchema,
} from "@/features/admin/lib/schema";
import { withAdmin } from "@/features/admin/server/guard";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { getSmtpConfig, isOidcConfigured } from "@/lib/config";
import {
  clearConfigOverrides,
  setAuditRetentionDays as dalSetAuditRetentionDays,
  setTwoFactorPolicy as dalSetTwoFactorPolicy,
  isOidcOnly,
  setConfigOverrides,
  setOidcOnly,
  setPublicSharingEnabled,
  setPublicSignUpEnabled,
} from "@/lib/dal/settings";
import { oidcEnabled } from "@/lib/env";
import { sendMail } from "@/lib/mail";

const twoFactorPolicySchema = z.enum(["off", "admins", "all"]);
const auditRetentionSchema = z.union([
  z.literal(0),
  z.literal(30),
  z.literal(90),
  z.literal(180),
  z.literal(365),
]);

// Every action runs through withAdmin (features/admin/server/guard.ts), which
// re-checks the admin role server-side — the /admin layout guard protects
// pages only, never these POST endpoints.

export async function setSignUpEnabled(
  enabled: boolean,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "toggle sign-up",
      failureMessage: t("settingUpdateFailed"),
    },
    async () => {
      await setPublicSignUpEnabled(enabled === true);
      return actionOk();
    },
  );
}

export async function setPublicSharing(
  enabled: boolean,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "toggle public sharing",
      failureMessage: t("settingUpdateFailed"),
      revalidate: false,
    },
    async () => {
      await setPublicSharingEnabled(enabled === true);
      return actionOk();
    },
  );
}

export async function setOidcOnlyEnabled(
  enabled: boolean,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "toggle oidc-only",
      failureMessage: t("settingUpdateFailed"),
    },
    async () => {
      // Refuse to lock the door when there is no other way in.
      if (enabled === true && !(await isOidcConfigured())) {
        return actionError(t("oidcNotConfigured"));
      }
      await setOidcOnly(enabled === true);
      return actionOk();
    },
  );
}

export async function setTwoFactorPolicy(
  policy: string,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "set 2FA policy",
      failureMessage: t("settingUpdateFailed"),
    },
    async () => {
      const parsed = twoFactorPolicySchema.safeParse(policy);
      if (!parsed.success) {
        return actionError(t("invalidInput"));
      }
      await dalSetTwoFactorPolicy(parsed.data);
      return actionOk();
    },
  );
}

export async function setAuditRetention(days: number): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "set audit retention",
      failureMessage: t("settingUpdateFailed"),
    },
    async () => {
      const parsed = auditRetentionSchema.safeParse(days);
      if (!parsed.success) {
        return actionError(t("invalidInput"));
      }
      await dalSetAuditRetentionDays(parsed.data);
      return actionOk();
    },
  );
}

// --- runtime config (SMTP / OIDC) ---

export async function updateSmtpSettings(
  input: SmtpSettingsValues,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "update smtp settings",
      failureMessage: t("settingUpdateFailed"),
    },
    async () => {
      const parsed = smtpSettingsSchema.safeParse(input);
      if (!parsed.success) {
        return actionError(
          parsed.error.issues[0]?.message ?? t("invalidInput"),
        );
      }
      const { host, port, secure, user, password, from } = parsed.data;
      await setConfigOverrides("smtp", {
        host,
        port: String(port),
        secure: String(secure),
        user: user || null,
        // null = keep the currently stored secret — don't write the key.
        ...(password !== null ? { password } : {}),
        from,
      });
      return actionOk();
    },
  );
}

export async function resetSmtpSettings(): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    { action: "reset smtp settings", failureMessage: t("settingUpdateFailed") },
    async () => {
      await clearConfigOverrides("smtp");
      return actionOk();
    },
  );
}

export async function updateOidcSettings(
  input: OidcSettingsValues,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "update oidc settings",
      failureMessage: t("settingUpdateFailed"),
    },
    async () => {
      const parsed = oidcSettingsSchema.safeParse(input);
      if (!parsed.success) {
        return actionError(
          parsed.error.issues[0]?.message ?? t("invalidInput"),
        );
      }
      // The discovery document must respond — a broken config does not enter.
      try {
        const response = await fetch(parsed.data.discoveryUrl, {
          signal: AbortSignal.timeout(5_000),
        });
        const doc = (await response.json()) as {
          authorization_endpoint?: unknown;
        };
        if (!response.ok || typeof doc.authorization_endpoint !== "string") {
          return actionError(t("oidcDiscoveryFailed"));
        }
      } catch {
        return actionError(t("oidcDiscoveryFailed"));
      }
      const {
        discoveryUrl,
        clientId,
        clientSecret,
        providerLabel,
        scopes,
        groupsClaim,
      } = parsed.data;
      await setConfigOverrides("oidc", {
        discoveryUrl,
        clientId,
        ...(clientSecret !== null ? { clientSecret } : {}),
        providerLabel,
        scopes,
        groupsClaim,
      });
      return actionOk();
    },
  );
}

export async function resetOidcSettings(): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    { action: "reset oidc settings", failureMessage: t("settingUpdateFailed") },
    async () => {
      // Resetting must not remove the only way in: when OIDC-only is active,
      // the environment alone has to keep OIDC alive after the DB overrides go.
      if ((await isOidcOnly()) && !oidcEnabled()) {
        return actionError(t("oidcNotConfigured"));
      }
      await clearConfigOverrides("oidc");
      return actionOk();
    },
  );
}

/** Sends a test email to the connected admin using the effective config. */
export async function sendTestEmail(): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "send test email",
      failureMessage: t("testEmailFailed"),
      revalidate: false,
    },
    async (admin) => {
      if (!(await getSmtpConfig())) {
        return actionError(t("smtpNotConfigured"));
      }
      const tMail = await getTranslations("admin.runtimeConfig");
      try {
        await sendMail({
          to: admin.email,
          subject: tMail("testEmailSubject"),
          text: tMail("testEmailBody"),
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return actionError(`${t("testEmailFailed")} ${detail}`);
      }
      return actionOk();
    },
  );
}
