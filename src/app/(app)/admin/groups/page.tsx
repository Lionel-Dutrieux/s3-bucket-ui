import type { Metadata } from "next";
import { GroupsManager } from "@/features/admin/components/groups-manager";
import { PageHeader } from "@/features/admin/components/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { listGroups } from "@/lib/dal/groups";
import { listUserOptions } from "@/lib/dal/users";

export const metadata: Metadata = { title: "Groups" };

export default async function AdminGroupsPage() {
  await requireAdmin();
  const [groups, users] = await Promise.all([listGroups(), listUserOptions()]);

  return (
    <>
      <PageHeader
        title="Groups"
        description="Groups bundle source access. At OIDC sign-in, claim values that exactly match a group name are assigned automatically — memberships added here by hand are never touched by that sync."
      />
      <GroupsManager groups={groups} users={users} />
    </>
  );
}
