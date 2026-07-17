"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  type BrandingValues,
  brandingSchema,
  type CreateUserValues,
  createUserSchema,
  grantInputSchema,
  groupNameSchema,
  type OidcSettingsValues,
  oidcSettingsSchema,
  roleSchema,
  type SmtpSettingsValues,
  smtpSettingsSchema,
} from "@/features/admin/lib/schema";
import { withAdmin } from "@/features/admin/server/guard";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { getAuth } from "@/lib/auth/auth";
import { getSmtpConfig, isOidcConfigured } from "@/lib/config";
import {
  addGroupMember as dalAddGroupMember,
  createGroup as dalCreateGroup,
  deleteGroup as dalDeleteGroup,
  removeGroupMember as dalRemoveGroupMember,
} from "@/lib/dal/groups";
import { deleteGrant, upsertGrant } from "@/lib/dal/permissions";
import {
  clearBrandingSettings,
  clearConfigOverrides,
  setAuditRetentionDays as dalSetAuditRetentionDays,
  setTwoFactorPolicy as dalSetTwoFactorPolicy,
  isOidcOnly,
  setConfigOverrides,
  setOidcOnly,
  setPublicSharingEnabled,
  setPublicSignUpEnabled,
  updateBrandingSettings,
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

// --- settings ---

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

export async function updateBranding(
  input: BrandingValues,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "update branding",
      failureMessage: t("brandingSaveFailed"),
    },
    async () => {
      const parsed = brandingSchema.safeParse(input);
      if (!parsed.success) {
        return actionError(
          parsed.error.issues[0]?.message ?? t("invalidInput"),
        );
      }
      await updateBrandingSettings(parsed.data);
      return actionOk();
    },
  );
}

export async function resetBranding(): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "reset branding",
      failureMessage: t("brandingResetFailed"),
    },
    async () => {
      await clearBrandingSettings();
      return actionOk();
    },
  );
}

// --- users (delegated to the better-auth admin plugin, which also handles
// session revocation on ban/removal) ---

export async function createUser(
  input: CreateUserValues,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "create user",
      context: input.email,
      failureMessage: t("createUserFailed"),
    },
    async () => {
      const parsed = createUserSchema.safeParse(input);
      if (!parsed.success) {
        return actionError(
          parsed.error.issues[0]?.message ?? t("invalidInput"),
        );
      }
      const auth = await getAuth();
      await auth.api.createUser({
        body: {
          name: parsed.data.name,
          email: parsed.data.email,
          password: parsed.data.password,
          role: parsed.data.role,
        },
        headers: await headers(),
      });
      return actionOk();
    },
  );
}

export async function setUserRole(
  userId: string,
  role: string,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "set role",
      context: `user=${userId}`,
      failureMessage: t("setRoleFailed"),
    },
    async (admin) => {
      const parsedRole = roleSchema.safeParse(role);
      if (!parsedRole.success) return actionError(t("unknownRole"));
      if (userId === admin.id) {
        return actionError(t("cannotChangeOwnRole"));
      }
      const auth = await getAuth();
      await auth.api.setRole({
        body: { userId, role: parsedRole.data },
        headers: await headers(),
      });
      return actionOk();
    },
  );
}

export async function banUser(userId: string): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "ban this user",
      context: `user=${userId}`,
      failureMessage: t("banUserFailed"),
    },
    async (admin) => {
      if (userId === admin.id) return actionError(t("cannotBanSelf"));
      const auth = await getAuth();
      await auth.api.banUser({ body: { userId }, headers: await headers() });
      return actionOk();
    },
  );
}

export async function unbanUser(userId: string): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "unban this user",
      context: `user=${userId}`,
      failureMessage: t("unbanUserFailed"),
    },
    async () => {
      const auth = await getAuth();
      await auth.api.unbanUser({ body: { userId }, headers: await headers() });
      return actionOk();
    },
  );
}

export async function removeUser(userId: string): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "remove this user",
      context: `user=${userId}`,
      failureMessage: t("removeUserFailed"),
    },
    async (admin) => {
      if (userId === admin.id) {
        return actionError(t("cannotRemoveSelf"));
      }
      const auth = await getAuth();
      await auth.api.removeUser({ body: { userId }, headers: await headers() });
      return actionOk();
    },
  );
}

// --- groups ---

export async function createGroup(name: string): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "create this group",
      context: name,
      failureMessage: t("createGroupFailed"),
    },
    async () => {
      const parsed = groupNameSchema.safeParse(name);
      if (!parsed.success) {
        return actionError(parsed.error.issues[0]?.message ?? t("invalidName"));
      }
      if ((await dalCreateGroup(parsed.data)) === "name-taken") {
        return actionError(t("groupNameTaken"));
      }
      return actionOk();
    },
  );
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "delete this group",
      context: `group=${groupId}`,
      failureMessage: t("deleteGroupFailed"),
    },
    async () => {
      await dalDeleteGroup(groupId);
      return actionOk();
    },
  );
}

export async function addGroupMember(
  groupId: string,
  userId: string,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "add this member",
      context: `group=${groupId}`,
      failureMessage: t("addMemberFailed"),
    },
    async () => {
      await dalAddGroupMember(groupId, userId);
      return actionOk();
    },
  );
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "remove this member",
      context: `group=${groupId}`,
      failureMessage: t("removeMemberFailed"),
    },
    async () => {
      await dalRemoveGroupMember(groupId, userId);
      return actionOk();
    },
  );
}

// --- source grants ---

export async function upsertSourceGrant(input: {
  sourceId: string;
  subject: { type: "user" | "group"; id: string };
  canEdit: boolean;
  canDelete: boolean;
}): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "save this grant",
      context: `source=${input.sourceId}`,
      failureMessage: t("saveGrantFailed"),
    },
    async () => {
      const parsed = grantInputSchema.safeParse(input);
      if (!parsed.success) return actionError(t("invalidGrant"));
      await upsertGrant(parsed.data);
      return actionOk();
    },
  );
}

export async function removeSourceGrant(
  grantId: string,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "remove this grant",
      context: `grant=${grantId}`,
      failureMessage: t("removeGrantFailed"),
    },
    async () => {
      await deleteGrant(grantId);
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
