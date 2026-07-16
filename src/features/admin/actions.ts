"use server";

import { headers } from "next/headers";
import {
  type BrandingValues,
  brandingSchema,
  type CreateUserValues,
  createUserSchema,
  grantInputSchema,
  groupNameSchema,
  roleSchema,
} from "@/features/admin/lib/schema";
import { withAdmin } from "@/features/admin/server/guard";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { auth } from "@/lib/auth/auth";
import {
  addGroupMember as dalAddGroupMember,
  createGroup as dalCreateGroup,
  deleteGroup as dalDeleteGroup,
  removeGroupMember as dalRemoveGroupMember,
} from "@/lib/dal/groups";
import { deleteGrant, upsertGrant } from "@/lib/dal/permissions";
import {
  clearBrandingSettings,
  setOidcOnly,
  setPublicSharingEnabled,
  setPublicSignUpEnabled,
  updateBrandingSettings,
} from "@/lib/dal/settings";
import { oidcEnabled } from "@/lib/env";

// Every action runs through withAdmin (features/admin/server/guard.ts), which
// re-checks the admin role server-side — the /admin layout guard protects
// pages only, never these POST endpoints.

// --- settings ---

export async function setSignUpEnabled(
  enabled: boolean,
): Promise<ActionResult> {
  return withAdmin(
    {
      action: "toggle sign-up",
      failureMessage: "Could not update this setting.",
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
  return withAdmin(
    {
      action: "toggle public sharing",
      failureMessage: "Could not update this setting.",
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
  return withAdmin(
    {
      action: "toggle oidc-only",
      failureMessage: "Could not update this setting.",
    },
    async () => {
      // Refuse to lock the door when there is no other way in.
      if (enabled === true && !oidcEnabled()) {
        return actionError(
          "Configure an OIDC provider first — enabling this now would lock everyone out.",
        );
      }
      await setOidcOnly(enabled === true);
      return actionOk();
    },
  );
}

export async function updateBranding(
  input: BrandingValues,
): Promise<ActionResult> {
  return withAdmin(
    {
      action: "update branding",
      failureMessage: "Could not save the branding settings.",
    },
    async () => {
      const parsed = brandingSchema.safeParse(input);
      if (!parsed.success) {
        return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
      }
      await updateBrandingSettings(parsed.data);
      return actionOk();
    },
  );
}

export async function resetBranding(): Promise<ActionResult> {
  return withAdmin(
    {
      action: "reset branding",
      failureMessage: "Could not reset the branding settings.",
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
  return withAdmin(
    {
      action: "create user",
      context: input.email,
      failureMessage:
        "Could not create this account — the email may already be in use.",
    },
    async () => {
      const parsed = createUserSchema.safeParse(input);
      if (!parsed.success) {
        return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
      }
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
  return withAdmin(
    {
      action: "set role",
      context: `user=${userId}`,
      failureMessage: "Could not change this user's role.",
    },
    async (admin) => {
      const parsedRole = roleSchema.safeParse(role);
      if (!parsedRole.success) return actionError("Unknown role.");
      if (userId === admin.id) {
        return actionError("You cannot change your own role.");
      }
      await auth.api.setRole({
        body: { userId, role: parsedRole.data },
        headers: await headers(),
      });
      return actionOk();
    },
  );
}

export async function banUser(userId: string): Promise<ActionResult> {
  return withAdmin(
    { action: "ban this user", context: `user=${userId}` },
    async (admin) => {
      if (userId === admin.id) return actionError("You cannot ban yourself.");
      await auth.api.banUser({ body: { userId }, headers: await headers() });
      return actionOk();
    },
  );
}

export async function unbanUser(userId: string): Promise<ActionResult> {
  return withAdmin(
    { action: "unban this user", context: `user=${userId}` },
    async () => {
      await auth.api.unbanUser({ body: { userId }, headers: await headers() });
      return actionOk();
    },
  );
}

export async function removeUser(userId: string): Promise<ActionResult> {
  return withAdmin(
    { action: "remove this user", context: `user=${userId}` },
    async (admin) => {
      if (userId === admin.id) {
        return actionError("You cannot remove yourself.");
      }
      await auth.api.removeUser({ body: { userId }, headers: await headers() });
      return actionOk();
    },
  );
}

// --- groups ---

export async function createGroup(name: string): Promise<ActionResult> {
  return withAdmin({ action: "create this group", context: name }, async () => {
    const parsed = groupNameSchema.safeParse(name);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid name.");
    }
    if ((await dalCreateGroup(parsed.data)) === "name-taken") {
      return actionError("A group with that name already exists.");
    }
    return actionOk();
  });
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  return withAdmin(
    { action: "delete this group", context: `group=${groupId}` },
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
  return withAdmin(
    { action: "add this member", context: `group=${groupId}` },
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
  return withAdmin(
    { action: "remove this member", context: `group=${groupId}` },
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
  return withAdmin(
    {
      action: "save this grant",
      context: `source=${input.sourceId}`,
    },
    async () => {
      const parsed = grantInputSchema.safeParse(input);
      if (!parsed.success) return actionError("Invalid grant.");
      await upsertGrant(parsed.data);
      return actionOk();
    },
  );
}

export async function removeSourceGrant(
  grantId: string,
): Promise<ActionResult> {
  return withAdmin(
    { action: "remove this grant", context: `grant=${grantId}` },
    async () => {
      await deleteGrant(grantId);
      return actionOk();
    },
  );
}
