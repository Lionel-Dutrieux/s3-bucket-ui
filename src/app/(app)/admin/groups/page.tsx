import { Plus, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CreateGroupDialog } from "@/features/admin/components/create-group-dialog";
import { GroupsTable } from "@/features/admin/components/groups-table";
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
      >
        <CreateGroupDialog>
          <Button size="sm">
            <Plus aria-hidden />
            Create group
          </Button>
        </CreateGroupDialog>
      </PageHeader>

      {groups.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No groups yet"
          description="Create one to grant several people the same sources at once — name it after an identity provider group to fill it automatically."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <GroupsTable groups={groups} users={users} />
        </div>
      )}
    </>
  );
}
