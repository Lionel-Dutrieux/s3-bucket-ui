import "server-only";
import { prisma } from "@/lib/prisma";

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
