import "server-only";
import { cache } from "react";
import { mergeGrants, type SourceGrant } from "@/lib/authz/permissions";
import { prisma } from "@/lib/prisma";

/** Grants that apply to a user on a source: direct + via group memberships.
 * Shared with `listSourcesFor` so the membership model changes in one place. */
export const grantsForUser = (userId: string) => ({
  OR: [{ userId }, { group: { members: { some: { userId } } } }],
});

/** Merged grant a user holds on a source, or null (no read access). */
export const getGrantFor = cache(
  async (userId: string, sourceId: string): Promise<SourceGrant | null> => {
    const rows = await prisma.sourcePermission.findMany({
      where: { sourceId, ...grantsForUser(userId) },
      select: { canEdit: true, canDelete: true },
    });
    return mergeGrants(rows);
  },
);

/** One grant row as the admin UI sees it. */
export interface GrantRow {
  id: string;
  subject:
    | { type: "user"; id: string; label: string }
    | { type: "group"; id: string; label: string };
  canEdit: boolean;
  canDelete: boolean;
}

export async function listGrantsForSource(
  sourceId: string,
): Promise<GrantRow[]> {
  const rows = await prisma.sourcePermission.findMany({
    where: { sourceId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    subject: row.user
      ? { type: "user", id: row.user.id, label: row.user.email }
      : // The CHECK constraint guarantees a group when there is no user.
        {
          type: "group",
          id: row.group?.id ?? "",
          label: row.group?.name ?? "",
        },
    canEdit: row.canEdit,
    canDelete: row.canDelete,
  }));
}

export interface GrantInput {
  sourceId: string;
  subject: { type: "user" | "group"; id: string };
  canEdit: boolean;
  canDelete: boolean;
}

export async function upsertGrant(input: GrantInput): Promise<void> {
  const { sourceId, subject, canEdit, canDelete } = input;
  if (subject.type === "user") {
    await prisma.sourcePermission.upsert({
      where: { sourceId_userId: { sourceId, userId: subject.id } },
      create: { sourceId, userId: subject.id, canEdit, canDelete },
      update: { canEdit, canDelete },
    });
  } else {
    await prisma.sourcePermission.upsert({
      where: { sourceId_groupId: { sourceId, groupId: subject.id } },
      create: { sourceId, groupId: subject.id, canEdit, canDelete },
      update: { canEdit, canDelete },
    });
  }
}

export async function deleteGrant(id: string): Promise<void> {
  await prisma.sourcePermission.deleteMany({ where: { id } });
}
