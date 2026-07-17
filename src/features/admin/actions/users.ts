"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import {
  type CreateUserValues,
  createUserSchema,
  roleSchema,
} from "@/features/admin/lib/schema";
import { withAdmin } from "@/features/admin/server/guard";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { getAuth } from "@/lib/auth/auth";

// Every action runs through withAdmin (features/admin/server/guard.ts), which
// re-checks the admin role server-side — the /admin layout guard protects
// pages only, never these POST endpoints.

// Users are delegated to the better-auth admin plugin, which also handles
// session revocation on ban/removal.

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
