import { UserRoundPlus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CreateUserDialog } from "@/features/admin/components/create-user-dialog";
import { StatCard } from "@/features/admin/components/stat-card";
import { UsersTable } from "@/features/admin/components/users-table";
import { requireAdmin } from "@/lib/auth/session";
import { listGroups } from "@/lib/dal/groups";
import { listUsers } from "@/lib/dal/users";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.usersPage");
  return { title: t("metaTitle") };
}

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const t = await getTranslations("admin.usersPage");
  const [users, groups] = await Promise.all([listUsers(), listGroups()]);
  const admins = users.filter((user) => user.role === "admin").length;
  const banned = users.filter((user) => user.banned).length;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")}>
        <CreateUserDialog>
          <Button size="sm">
            <UserRoundPlus aria-hidden />
            {t("createUser")}
          </Button>
        </CreateUserDialog>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("accountsLabel")}
          value={users.length}
          detail={
            banned > 0
              ? t("bannedDetail", { count: banned })
              : t("noneBannedDetail")
          }
        />
        <StatCard
          label={t("adminsLabel")}
          value={admins}
          detail={t("adminsDetail")}
        />
        <StatCard
          label={t("groupsLabel")}
          value={groups.length}
          detail={t("groupsDetail")}
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <UsersTable users={users} selfId={session.user.id} />
      </div>
    </>
  );
}
