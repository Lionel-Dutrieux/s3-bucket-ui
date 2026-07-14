"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  type CreateUserValues,
  createUserSchema,
  grantInputSchema,
  groupNameSchema,
  roleSchema,
} from "@/features/admin/lib/schema";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { auth } from "@/lib/auth/auth";
import { currentAdmin } from "@/lib/auth/session";
import {
  addGroupMember as dalAddGroupMember,
  createGroup as dalCreateGroup,
  deleteGroup as dalDeleteGroup,
  removeGroupMember as dalRemoveGroupMember,
  renameGroup as dalRenameGroup,
} from "@/lib/dal/groups";
import { deleteGrant, upsertGrant } from "@/lib/dal/permissions";

const NOT_AUTHORIZED = "You are not allowed to administrate this app.";

// Every action re-checks the admin role server-side — the /admin layout guard
// protects pages only, never these POST endpoints.

// --- users (delegated to the better-auth admin plugin, which also handles
// session revocation on ban/removal) ---

export async function createUser(
  input: CreateUserValues,
): Promise<ActionResult> {
  if (!(await currentAdmin())) return actionError(NOT_AUTHORIZED);
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    await auth.api.createUser({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        role: parsed.data.role,
      },
      headers: await headers(),
    });
  } catch (error) {
    console.error(`[admin] create user failed (${parsed.data.email}):`, error);
    return actionError(
      "Could not create this account — the email may already be in use.",
    );
  }
  revalidatePath("/", "layout");
  return actionOk();
}

export async function setUserRole(
  userId: string,
  role: string,
): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return actionError(NOT_AUTHORIZED);
  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) return actionError("Unknown role.");
  if (userId === admin.id) {
    return actionError("You cannot change your own role.");
  }

  try {
    await auth.api.setRole({
      body: { userId, role: parsedRole.data },
      headers: await headers(),
    });
  } catch (error) {
    console.error(`[admin] set role failed (user=${userId}):`, error);
    return actionError("Could not change this user's role.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}

export async function banUser(userId: string): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return actionError(NOT_AUTHORIZED);
  if (userId === admin.id) return actionError("You cannot ban yourself.");

  try {
    await auth.api.banUser({ body: { userId }, headers: await headers() });
  } catch (error) {
    console.error(`[admin] ban failed (user=${userId}):`, error);
    return actionError("Could not ban this user.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}

export async function unbanUser(userId: string): Promise<ActionResult> {
  if (!(await currentAdmin())) return actionError(NOT_AUTHORIZED);

  try {
    await auth.api.unbanUser({ body: { userId }, headers: await headers() });
  } catch (error) {
    console.error(`[admin] unban failed (user=${userId}):`, error);
    return actionError("Could not unban this user.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}

export async function removeUser(userId: string): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return actionError(NOT_AUTHORIZED);
  if (userId === admin.id) return actionError("You cannot remove yourself.");

  try {
    await auth.api.removeUser({ body: { userId }, headers: await headers() });
  } catch (error) {
    console.error(`[admin] remove failed (user=${userId}):`, error);
    return actionError("Could not remove this user.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}

// --- groups ---

export async function createGroup(name: string): Promise<ActionResult> {
  if (!(await currentAdmin())) return actionError(NOT_AUTHORIZED);
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid name.");
  }

  try {
    await dalCreateGroup(parsed.data);
  } catch {
    return actionError("A group with that name already exists.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}

export async function renameGroup(
  groupId: string,
  name: string,
): Promise<ActionResult> {
  if (!(await currentAdmin())) return actionError(NOT_AUTHORIZED);
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid name.");
  }

  try {
    await dalRenameGroup(groupId, parsed.data);
  } catch {
    return actionError("A group with that name already exists.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  if (!(await currentAdmin())) return actionError(NOT_AUTHORIZED);

  try {
    await dalDeleteGroup(groupId);
  } catch (error) {
    console.error(`[admin] delete group failed (group=${groupId}):`, error);
    return actionError("Could not delete this group.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}

export async function addGroupMember(
  groupId: string,
  userId: string,
): Promise<ActionResult> {
  if (!(await currentAdmin())) return actionError(NOT_AUTHORIZED);

  try {
    await dalAddGroupMember(groupId, userId);
  } catch (error) {
    console.error(`[admin] add member failed (group=${groupId}):`, error);
    return actionError("Could not add this member.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
): Promise<ActionResult> {
  if (!(await currentAdmin())) return actionError(NOT_AUTHORIZED);

  try {
    await dalRemoveGroupMember(groupId, userId);
  } catch (error) {
    console.error(`[admin] remove member failed (group=${groupId}):`, error);
    return actionError("Could not remove this member.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}

// --- source grants ---

export async function upsertSourceGrant(input: {
  sourceId: string;
  subject: { type: "user" | "group"; id: string };
  canEdit: boolean;
  canDelete: boolean;
}): Promise<ActionResult> {
  if (!(await currentAdmin())) return actionError(NOT_AUTHORIZED);
  const parsed = grantInputSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid grant.");

  try {
    await upsertGrant(parsed.data);
  } catch (error) {
    console.error(`[admin] grant failed (source=${input.sourceId}):`, error);
    return actionError("Could not save this grant.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}

export async function removeSourceGrant(
  grantId: string,
): Promise<ActionResult> {
  if (!(await currentAdmin())) return actionError(NOT_AUTHORIZED);

  try {
    await deleteGrant(grantId);
  } catch (error) {
    console.error(`[admin] remove grant failed (grant=${grantId}):`, error);
    return actionError("Could not remove this grant.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}
