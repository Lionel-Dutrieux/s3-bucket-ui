"use client";

import { Trash2, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteGroup } from "@/features/admin/actions/groups";
import { GroupMembersDialog } from "@/features/admin/components/group-members-dialog";
import type { GroupRow } from "@/lib/dal/groups";
import type { UserOption } from "@/lib/dal/users";
import { formatDateTime } from "@/lib/format";

export function GroupsTable({
  groups,
  users,
}: {
  groups: GroupRow[];
  users: UserOption[];
}) {
  const [deleting, setDeleting] = useState<GroupRow | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations("admin.groupsTable");

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t("groupColumn")}</TableHead>
            <TableHead className="w-40">{t("membersColumn")}</TableHead>
            <TableHead className="w-44 max-md:hidden">
              {t("createdColumn")}
            </TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow key={group.id}>
              <TableCell>
                <span className="flex items-center gap-2">
                  <UsersRound
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="truncate text-sm font-medium">
                    {group.name}
                  </span>
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground tabular-nums">
                {t("memberCount", { count: group.members.length })}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground tabular-nums max-md:hidden">
                {formatDateTime(group.createdAt)}
              </TableCell>
              <TableCell>
                <span className="flex justify-end gap-1">
                  <GroupMembersDialog group={group} users={users}>
                    <Button variant="outline" size="sm">
                      {t("members")}
                    </Button>
                  </GroupMembersDialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() => setDeleting(group)}
                    aria-label={t("deleteAria", { name: group.name })}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("confirmDeleteTitle", { name: deleting?.name ?? "" })}
        description={t("confirmDeleteDescription")}
        confirmLabel={t("confirmDeleteLabel")}
        pendingLabel={t("confirmDeleting")}
        pending={pending}
        onConfirm={() => {
          if (!deleting) return;
          startTransition(async () => {
            const result = await deleteGroup(deleting.id);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setDeleting(null);
            router.refresh();
          });
        }}
      />
    </>
  );
}
