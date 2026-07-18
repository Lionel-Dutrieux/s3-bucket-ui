"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  sharePolicySchema,
  smtpSettingsSchema,
} from "@/features/admin/lib/schema";
import { getSmtpConfig } from "@/lib/config";
import {
  clearConfigOverrides,
  setAuditRetentionDays as dalSetAuditRetentionDays,
  setSharePolicy as dalSetSharePolicy,
  setTwoFactorPolicy as dalSetTwoFactorPolicy,
  setConfigOverrides,
  setOidcOnly,
  setPublicSharingEnabled,
  setPublicSignUpEnabled,
} from "@/lib/dal/settings";
import { hasSsoProviders } from "@/lib/dal/sso";
import { sendMail } from "@/lib/mail";
import { ActionError, adminActionClient } from "@/lib/safe-action";

const twoFactorPolicySchema = z.enum(["off", "admins", "all"]);
const auditRetentionSchema = z.union([
  z.literal(0),
  z.literal(30),
  z.literal(90),
  z.literal(180),
  z.literal(365),
]);

// Every action runs through adminActionClient (src/lib/safe-action.ts), which
// re-checks the admin role server-side — the /admin layout guard protects
// pages only, never these POST endpoints — and revalidates the root layout on
// success unless the metadata opts out.

export const setSignUpEnabled = adminActionClient
  .metadata({
    actionName: "admin.setSignUpEnabled",
    failureKey: "admin.errors.settingUpdateFailed",
  })
  .inputSchema(z.object({ enabled: z.boolean() }))
  .action(async ({ parsedInput }) => {
    await setPublicSignUpEnabled(parsedInput.enabled);
  });

export const setPublicSharing = adminActionClient
  .metadata({
    actionName: "admin.setPublicSharing",
    failureKey: "admin.errors.settingUpdateFailed",
    revalidate: false,
  })
  .inputSchema(z.object({ enabled: z.boolean() }))
  .action(async ({ parsedInput }) => {
    await setPublicSharingEnabled(parsedInput.enabled);
  });

export const setOidcOnlyEnabled = adminActionClient
  .metadata({
    actionName: "admin.setOidcOnlyEnabled",
    failureKey: "admin.errors.settingUpdateFailed",
  })
  .inputSchema(z.object({ enabled: z.boolean() }))
  .action(async ({ parsedInput }) => {
    // Refuse to lock the door when there is no other way in.
    if (parsedInput.enabled && !(await hasSsoProviders())) {
      const t = await getTranslations("admin.errors");
      throw new ActionError(t("oidcNotConfigured"));
    }
    await setOidcOnly(parsedInput.enabled);
  });

export const setTwoFactorPolicy = adminActionClient
  .metadata({
    actionName: "admin.setTwoFactorPolicy",
    failureKey: "admin.errors.settingUpdateFailed",
  })
  .inputSchema(z.object({ policy: twoFactorPolicySchema }))
  .action(async ({ parsedInput }) => {
    await dalSetTwoFactorPolicy(parsedInput.policy);
  });

export const setSharePolicy = adminActionClient
  .metadata({
    actionName: "admin.setSharePolicy",
    failureKey: "admin.errors.settingUpdateFailed",
    // The source pages read this on render — a new setting takes effect on
    // the next navigation, no path revalidation needed.
    revalidate: false,
  })
  .inputSchema(sharePolicySchema)
  .action(async ({ parsedInput }) => {
    await dalSetSharePolicy({
      maxExpiryDays:
        parsedInput.maxExpiryDays > 0 ? parsedInput.maxExpiryDays : null,
      requirePassword: parsedInput.requirePassword,
    });
  });

export const setAuditRetention = adminActionClient
  .metadata({
    actionName: "admin.setAuditRetention",
    failureKey: "admin.errors.settingUpdateFailed",
  })
  .inputSchema(z.object({ days: auditRetentionSchema }))
  .action(async ({ parsedInput }) => {
    await dalSetAuditRetentionDays(parsedInput.days);
  });

// --- runtime config (SMTP / OIDC) ---

export const updateSmtpSettings = adminActionClient
  .metadata({
    actionName: "admin.updateSmtpSettings",
    failureKey: "admin.errors.settingUpdateFailed",
  })
  .inputSchema(smtpSettingsSchema)
  .action(async ({ parsedInput }) => {
    const { host, port, secure, user, password, from } = parsedInput;
    await setConfigOverrides("smtp", {
      host,
      port: String(port),
      secure: String(secure),
      user: user || null,
      // null = keep the currently stored secret — don't write the key.
      ...(password !== null ? { password } : {}),
      from,
    });
  });

export const resetSmtpSettings = adminActionClient
  .metadata({
    actionName: "admin.resetSmtpSettings",
    failureKey: "admin.errors.settingUpdateFailed",
  })
  .inputSchema(z.object({}))
  .action(async () => {
    await clearConfigOverrides("smtp");
  });

/** Sends a test email to the connected admin using the effective config. */
export const sendTestEmail = adminActionClient
  .metadata({
    actionName: "admin.sendTestEmail",
    failureKey: "admin.errors.testEmailFailed",
    revalidate: false,
  })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    const t = await getTranslations("admin.errors");
    if (!(await getSmtpConfig())) {
      throw new ActionError(t("smtpNotConfigured"));
    }
    const tMail = await getTranslations("admin.runtimeConfig");
    try {
      await sendMail({
        to: ctx.admin.email,
        subject: tMail("testEmailSubject"),
        text: tMail("testEmailBody"),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ActionError(`${t("testEmailFailed")} ${detail}`);
    }
  });
