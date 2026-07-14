import type { Metadata } from "next";
import { UsersTable } from "@/features/admin/components/users-table";
import { requireAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/dal/users";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const users = await listUsers();

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Accounts are created by public sign-up (the very first one became
        admin). New users see nothing until you grant them sources.
      </p>
      <UsersTable users={users} selfId={session.user.id} />
    </div>
  );
}
