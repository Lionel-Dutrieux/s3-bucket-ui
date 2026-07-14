import type { Metadata } from "next";
import { GroupsManager } from "@/features/admin/components/groups-manager";
import { requireAdmin } from "@/lib/auth/session";
import { listGroups } from "@/lib/dal/groups";
import { listUserOptions } from "@/lib/dal/users";

export const metadata: Metadata = { title: "Groups" };

export default async function AdminGroupsPage() {
  await requireAdmin();
  const [groups, users] = await Promise.all([listGroups(), listUserOptions()]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Groups bundle source access. At OIDC sign-in, values of the identity
        provider&rsquo;s groups claim that exactly match a group name here are
        assigned automatically; memberships you add by hand are never touched by
        that sync.
      </p>
      <GroupsManager groups={groups} users={users} />
    </div>
  );
}
