import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface GroupMemberRow {
  userId: string;
  name: string;
  email: string;
  /** "manual" (added by an admin) or "oidc" (assigned by the claim sync). */
  via: string;
}

export interface GroupRow {
  id: string;
  name: string;
  createdAt: Date;
  members: GroupMemberRow[];
}

export async function listGroups(): Promise<GroupRow[]> {
  const rows = await prisma.group.findMany({
    orderBy: { name: "asc" },
    include: {
      members: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { user: { email: "asc" } },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    members: row.members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      via: member.via,
    })),
  }));
}

/** Option list for grant subject pickers. */
export async function listGroupOptions(): Promise<
  { id: string; label: string }[]
> {
  const rows = await prisma.group.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows.map((row) => ({ id: row.id, label: row.name }));
}

/** Creates a group; reports a name collision as a value, not an exception. */
export async function createGroup(
  name: string,
): Promise<"created" | "name-taken"> {
  try {
    await prisma.group.create({ data: { name } });
    return "created";
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return "name-taken";
    }
    throw error;
  }
}

export async function deleteGroup(id: string): Promise<void> {
  await prisma.group.deleteMany({ where: { id } });
}

/** Admin-added membership — marked manual so the OIDC sync never removes it. */
export async function addGroupMember(
  groupId: string,
  userId: string,
): Promise<void> {
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    create: { groupId, userId, via: "manual" },
    update: { via: "manual" },
  });
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
): Promise<void> {
  await prisma.groupMember.deleteMany({ where: { groupId, userId } });
}

/**
 * Reconciles a user's group memberships with the IdP `groups` claim (à la
 * Homarr): claim names are matched exactly against app group names; matched
 * groups get an `oidc` membership, and `oidc` memberships no longer backed by
 * the claim are removed. Memberships added by an admin (`via: "manual"`) are
 * never touched. Never throws — a misbehaving IdP must not break sign-in.
 */
export async function syncOidcMemberships(
  userId: string,
  claimGroups: string[],
): Promise<void> {
  try {
    const matched = await prisma.group.findMany({
      where: { name: { in: claimGroups } },
      select: { id: true },
    });
    const matchedIds = matched.map((group) => group.id);
    await prisma.$transaction([
      prisma.groupMember.deleteMany({
        where: { userId, via: "oidc", groupId: { notIn: matchedIds } },
      }),
      ...matchedIds.map((groupId) =>
        prisma.groupMember.upsert({
          where: { groupId_userId: { groupId, userId } },
          create: { groupId, userId, via: "oidc" },
          update: {},
        }),
      ),
    ]);
  } catch (error) {
    console.error("Failed to sync OIDC group memberships", error);
  }
}
