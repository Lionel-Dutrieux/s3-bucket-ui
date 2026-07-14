import "server-only";
import { prisma } from "@/lib/prisma";

/** One row of the admin users table. */
export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  createdAt: Date;
  groups: string[];
}

export async function listUsers(): Promise<UserRow[]> {
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      banned: true,
      createdAt: true,
      memberships: {
        select: { group: { select: { name: true } } },
        orderBy: { group: { name: "asc" } },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role ?? "user",
    banned: row.banned ?? false,
    createdAt: row.createdAt,
    groups: row.memberships.map((membership) => membership.group.name),
  }));
}

/** Lightweight option list for subject pickers (grants, group members). */
export interface UserOption {
  id: string;
  label: string;
}

export async function listUserOptions(): Promise<UserOption[]> {
  const rows = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true },
  });
  return rows.map((row) => ({ id: row.id, label: row.email }));
}
