import { Plus, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CreateGroupDialog } from "@/features/admin/components/create-group-dialog";
import { GroupsTable } from "@/features/admin/components/groups-table";
import { requireAdmin } from "@/lib/auth/session";
import { listGroups } from "@/lib/dal/groups";
import { listUserOptions } from "@/lib/dal/users";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.groupsPage");
  return { title: t("metaTitle") };
}

export default async function AdminGroupsPage() {
  await requireAdmin();
  const t = await getTranslations("admin.groupsPage");
  const [groups, users] = await Promise.all([listGroups(), listUserOptions()]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")}>
        <CreateGroupDialog>
          <Button size="sm">
            <Plus aria-hidden />
            {t("createGroup")}
          </Button>
        </CreateGroupDialog>
      </PageHeader>

      {groups.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <GroupsTable groups={groups} users={users} />
        </div>
      )}
    </>
  );
}
