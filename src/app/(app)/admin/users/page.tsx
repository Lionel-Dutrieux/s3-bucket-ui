import { UserRoundPlus } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { CreateUserDialog } from "@/features/admin/components/create-user-dialog";
import { PageHeader } from "@/features/admin/components/page-header";
import { UsersTable } from "@/features/admin/components/users-table";
import { requireAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/dal/users";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const users = await listUsers();

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

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <UsersTable users={users} selfId={session.user.id} />
      </div>
    </>
  );
}
