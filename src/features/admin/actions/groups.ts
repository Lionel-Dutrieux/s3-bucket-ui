"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { grantInputSchema, groupNameSchema } from "@/features/admin/lib/schema";
import {
  addGroupMember as dalAddGroupMember,
  createGroup as dalCreateGroup,
  deleteGroup as dalDeleteGroup,
  removeGroupMember as dalRemoveGroupMember,
} from "@/lib/dal/groups";
import { deleteGrant, upsertGrant } from "@/lib/dal/permissions";
import { ActionError, adminActionClient } from "@/lib/safe-action";

// Every action runs through adminActionClient (src/lib/safe-action.ts), which
// re-checks the admin role server-side — the /admin layout guard protects
// pages only, never these POST endpoints — and revalidates the root layout on
// success.

// --- groups ---

export const createGroup = adminActionClient
  .metadata({
    actionName: "admin.createGroup",
    failureKey: "admin.errors.createGroupFailed",
  })
  .inputSchema(z.object({ name: groupNameSchema }))
  .action(async ({ parsedInput }) => {
    const t = await getTranslations("admin.errors");
    if ((await dalCreateGroup(parsedInput.name)) === "name-taken") {
      throw new ActionError(t("groupNameTaken"));
    }
  });

export const deleteGroup = adminActionClient
  .metadata({
    actionName: "admin.deleteGroup",
    failureKey: "admin.errors.deleteGroupFailed",
  })
  .inputSchema(z.object({ groupId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    await dalDeleteGroup(parsedInput.groupId);
  });

export const addGroupMember = adminActionClient
  .metadata({
    actionName: "admin.addGroupMember",
    failureKey: "admin.errors.addMemberFailed",
  })
  .inputSchema(
    z.object({ groupId: z.string().min(1), userId: z.string().min(1) }),
  )
  .action(async ({ parsedInput }) => {
    await dalAddGroupMember(parsedInput.groupId, parsedInput.userId);
  });

export const removeGroupMember = adminActionClient
  .metadata({
    actionName: "admin.removeGroupMember",
    failureKey: "admin.errors.removeMemberFailed",
  })
  .inputSchema(
    z.object({ groupId: z.string().min(1), userId: z.string().min(1) }),
  )
  .action(async ({ parsedInput }) => {
    await dalRemoveGroupMember(parsedInput.groupId, parsedInput.userId);
  });

// --- source grants ---

export const upsertSourceGrant = adminActionClient
  .metadata({
    actionName: "admin.upsertSourceGrant",
    failureKey: "admin.errors.saveGrantFailed",
  })
  .inputSchema(grantInputSchema)
  .action(async ({ parsedInput }) => {
    await upsertGrant(parsedInput);
  });

export const removeSourceGrant = adminActionClient
  .metadata({
    actionName: "admin.removeSourceGrant",
    failureKey: "admin.errors.removeGrantFailed",
  })
  .inputSchema(z.object({ grantId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    await deleteGrant(parsedInput.grantId);
  });
