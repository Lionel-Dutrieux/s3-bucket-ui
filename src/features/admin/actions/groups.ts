"use server";

import { getTranslations } from "next-intl/server";
import { grantInputSchema, groupNameSchema } from "@/features/admin/lib/schema";
import { withAdmin } from "@/features/admin/server/guard";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import {
  addGroupMember as dalAddGroupMember,
  createGroup as dalCreateGroup,
  deleteGroup as dalDeleteGroup,
  removeGroupMember as dalRemoveGroupMember,
} from "@/lib/dal/groups";
import { deleteGrant, upsertGrant } from "@/lib/dal/permissions";

// Every action runs through withAdmin (features/admin/server/guard.ts), which
// re-checks the admin role server-side — the /admin layout guard protects
// pages only, never these POST endpoints.

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
