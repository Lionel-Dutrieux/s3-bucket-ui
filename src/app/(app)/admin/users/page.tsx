import { UserRoundPlus } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CreateUserDialog } from "@/features/admin/components/create-user-dialog";
import { StatCard } from "@/features/admin/components/stat-card";
import { UsersTable } from "@/features/admin/components/users-table";
import { requireAdmin } from "@/lib/auth/session";
import { listGroups } from "@/lib/dal/groups";
import { listUsers } from "@/lib/dal/users";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const [users, groups] = await Promise.all([listUsers(), listGroups()]);
  const admins = users.filter((user) => user.role === "admin").length;
  const banned = users.filter((user) => user.banned).length;

  return (
    <>
      <PageHeader
        title="Users"
        description="Accounts sign up themselves or are created here. New users see nothing until you grant them sources."
      >
        <CreateUserDialog>
          <Button size="sm">
            <UserRoundPlus aria-hidden />
            Create user
          </Button>
        </CreateUserDialog>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Accounts"
          value={users.length}
          detail={banned > 0 ? `${banned} banned` : "none banned"}
        />
        <StatCard
          label="Admins"
          value={admins}
          detail="full access to every source"
        />
        <StatCard
          label="Groups"
          value={groups.length}
          detail="shared source access"
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <UsersTable users={users} selfId={session.user.id} />
      </div>
    </>
  );
}
