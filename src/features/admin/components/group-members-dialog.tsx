"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  addGroupMember,
  removeGroupMember,
} from "@/features/admin/actions/groups";
import { SearchCombobox } from "@/features/admin/components/search-combobox";
import type { ActionResult } from "@/lib/action-result";
import type { GroupRow } from "@/lib/dal/groups";
import type { UserOption } from "@/lib/dal/users";

export function GroupMembersDialog({
  group,
  users,
  children,
}: {
  group: GroupRow;
  users: UserOption[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations("admin.groupMembersDialog");

  const run = (work: () => Promise<ActionResult>) => {
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const memberIds = new Set(group.members.map((member) => member.userId));
  const candidates = users
    .filter((user) => !memberIds.has(user.id))
    .map((user) => ({ value: user.id, label: user.label }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{group.name}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {group.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emptyMembers")}</p>
          ) : (
            <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
              {group.members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center gap-2 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                  {member.via === "oidc" ? (
                    <span
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground"
                      title={t("oidcBadgeTitle")}
                    >
                      {t("oidcBadge")}
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground"
                    disabled={pending}
                    onClick={() =>
                      run(() => removeGroupMember(group.id, member.userId))
                    }
                    aria-label={t("removeAria", {
                      email: member.email,
                      name: group.name,
                    })}
                  >
                    <X className="size-3.5" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <SearchCombobox
            label={t("addMember")}
            searchPlaceholder={t("searchPlaceholder")}
            emptyMessage={t("emptyMessage")}
            groups={[{ heading: t("usersHeading"), options: candidates }]}
            onSelect={(userId) => run(() => addGroupMember(group.id, userId))}
            disabled={pending}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
