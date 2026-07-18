"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createUserSchema, roleSchema } from "@/features/admin/lib/schema";
import { getAuth } from "@/lib/auth/auth";
import { ActionError, adminActionClient } from "@/lib/safe-action";

// Every action runs through adminActionClient (src/lib/safe-action.ts), which
// re-checks the admin role server-side — the /admin layout guard protects
// pages only, never these POST endpoints — and revalidates the root layout on
// success.

// Users are delegated to the better-auth admin plugin, which also handles
// session revocation on ban/removal.

export const createUser = adminActionClient
  .metadata({
    actionName: "admin.createUser",
    failureKey: "admin.errors.createUserFailed",
  })
  .inputSchema(createUserSchema)
  .action(async ({ parsedInput }) => {
    const auth = await getAuth();
    await auth.api.createUser({
      body: {
        name: parsedInput.name,
        email: parsedInput.email,
        password: parsedInput.password,
        role: parsedInput.role,
      },
      headers: await headers(),
    });
  });

export const setUserRole = adminActionClient
  .metadata({
    actionName: "admin.setUserRole",
    failureKey: "admin.errors.setRoleFailed",
  })
  .inputSchema(z.object({ userId: z.string().min(1), role: roleSchema }))
  .action(async ({ parsedInput, ctx }) => {
    if (parsedInput.userId === ctx.admin.id) {
      const t = await getTranslations("admin.errors");
      throw new ActionError(t("cannotChangeOwnRole"));
    }
    const auth = await getAuth();
    await auth.api.setRole({
      body: { userId: parsedInput.userId, role: parsedInput.role },
      headers: await headers(),
    });
  });

export const banUser = adminActionClient
  .metadata({
    actionName: "admin.banUser",
    failureKey: "admin.errors.banUserFailed",
  })
  .inputSchema(z.object({ userId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    if (parsedInput.userId === ctx.admin.id) {
      const t = await getTranslations("admin.errors");
      throw new ActionError(t("cannotBanSelf"));
    }
    const auth = await getAuth();
    await auth.api.banUser({
      body: { userId: parsedInput.userId },
      headers: await headers(),
    });
  });

export const unbanUser = adminActionClient
  .metadata({
    actionName: "admin.unbanUser",
    failureKey: "admin.errors.unbanUserFailed",
  })
  .inputSchema(z.object({ userId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    const auth = await getAuth();
    await auth.api.unbanUser({
      body: { userId: parsedInput.userId },
      headers: await headers(),
    });
  });

export const removeUser = adminActionClient
  .metadata({
    actionName: "admin.removeUser",
    failureKey: "admin.errors.removeUserFailed",
  })
  .inputSchema(z.object({ userId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    if (parsedInput.userId === ctx.admin.id) {
      const t = await getTranslations("admin.errors");
      throw new ActionError(t("cannotRemoveSelf"));
    }
    const auth = await getAuth();
    await auth.api.removeUser({
      body: { userId: parsedInput.userId },
      headers: await headers(),
    });
  });
