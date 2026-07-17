"use client";

import { UserRound, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { removeSourceGrant, upsertSourceGrant } from "@/features/admin/actions";
import { SearchCombobox } from "@/features/admin/components/search-combobox";
import type { ActionResult } from "@/lib/action-result";
import type { GrantRow } from "@/lib/dal/permissions";

export interface SubjectOption {
  id: string;
  label: string;
}

/**
 * Grant editor for one source: who can read it (a row = read access), with
 * per-row Edit/Delete switches. Subjects are users or groups, added through
 * a type-to-search picker.
 */
export function SourceAccess({
  sourceId,
  grants,
  users,
  groups,
}: {
  sourceId: string;
  grants: GrantRow[];
  users: SubjectOption[];
  groups: SubjectOption[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations("admin.sourceAccess");

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

  const granted = new Set(
    grants.map((grant) => `${grant.subject.type}:${grant.subject.id}`),
  );
  const pickerGroups = [
    {
      heading: t("groupsHeading"),
      options: groups
        .filter((group) => !granted.has(`group:${group.id}`))
        .map((group) => ({ value: `group:${group.id}`, label: group.label })),
    },
    {
      heading: t("usersHeading"),
      options: users
        .filter((user) => !granted.has(`user:${user.id}`))
        .map((user) => ({ value: `user:${user.id}`, label: user.label })),
    },
  ];

  // Values are encoded "user:<id>" / "group:<id>" — one picker, both kinds.
  const addGrant = (value: string) => {
    const [type, id] = value.split(":", 2) as ["user" | "group", string];
    run(() =>
      upsertSourceGrant({
        sourceId,
        subject: { type, id },
        canEdit: false,
        canDelete: false,
      }),
    );
  };

  return (
    <div className="space-y-3">
      {grants.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {grants.map((grant) => (
            <li key={grant.id} className="flex items-center gap-3 px-3 py-2">
              {grant.subject.type === "group" ? (
                <UsersRound
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              ) : (
                <UserRound
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">
                {grant.subject.label}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {t("editLabel")}
                <Switch
                  checked={grant.canEdit}
                  disabled={pending}
                  aria-label={t("allowEditAria", { name: grant.subject.label })}
                  onCheckedChange={(checked) =>
                    run(() =>
                      upsertSourceGrant({
                        sourceId,
                        subject: grant.subject,
                        canEdit: checked,
                        canDelete: grant.canDelete,
                      }),
                    )
                  }
                />
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {t("deleteLabel")}
                <Switch
                  checked={grant.canDelete}
                  disabled={pending}
                  aria-label={t("allowDeleteAria", {
                    name: grant.subject.label,
                  })}
                  onCheckedChange={(checked) =>
                    run(() =>
                      upsertSourceGrant({
                        sourceId,
                        subject: grant.subject,
                        canEdit: grant.canEdit,
                        canDelete: checked,
                      }),
                    )
                  }
                />
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground"
                disabled={pending}
                onClick={() => run(() => removeSourceGrant(grant.id))}
                aria-label={t("revokeAria", { name: grant.subject.label })}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <SearchCombobox
        label={t("grantAccess")}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("emptyMessage")}
        groups={pickerGroups}
        onSelect={addGrant}
        disabled={pending}
      />
    </div>
  );
}
