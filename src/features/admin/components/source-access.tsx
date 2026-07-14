"use client";

import { Plus, UserRound, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { removeSourceGrant, upsertSourceGrant } from "@/features/admin/actions";
import type { ActionResult } from "@/lib/action-result";
import type { GrantRow } from "@/lib/dal/permissions";

export interface SubjectOption {
  id: string;
  label: string;
}

/**
 * Grant editor for one source: who can read it (a row = read access), with
 * per-row Edit/Delete switches. Subjects are users or groups.
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
  // Encoded as "user:<id>" / "group:<id>" so one Select covers both kinds.
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (work: () => Promise<ActionResult>, done?: () => void) => {
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      done?.();
      router.refresh();
    });
  };

  const granted = new Set(
    grants.map((grant) => `${grant.subject.type}:${grant.subject.id}`),
  );
  const userOptions = users.filter((user) => !granted.has(`user:${user.id}`));
  const groupOptions = groups.filter(
    (group) => !granted.has(`group:${group.id}`),
  );

  const addGrant = () => {
    const [type, id] = selected.split(":", 2) as ["user" | "group", string];
    run(
      () =>
        upsertSourceGrant({
          sourceId,
          subject: { type, id },
          canEdit: false,
          canDelete: false,
        }),
      () => setSelected(""),
    );
  };

  return (
    <div className="space-y-3">
      {grants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nobody has access yet — only admins can see this source. Grant a user
          or a group read access below.
        </p>
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
                Edit
                <Switch
                  checked={grant.canEdit}
                  disabled={pending}
                  aria-label={`Allow ${grant.subject.label} to edit`}
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
                Delete
                <Switch
                  checked={grant.canDelete}
                  disabled={pending}
                  aria-label={`Allow ${grant.subject.label} to delete`}
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
                aria-label={`Revoke access for ${grant.subject.label}`}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="flex-1" aria-label="Subject to grant">
            <SelectValue placeholder="Grant access to…" />
          </SelectTrigger>
          <SelectContent>
            {groupOptions.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Groups</SelectLabel>
                {groupOptions.map((group) => (
                  <SelectItem key={group.id} value={`group:${group.id}`}>
                    {group.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
            {userOptions.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Users</SelectLabel>
                {userOptions.map((user) => (
                  <SelectItem key={user.id} value={`user:${user.id}`}>
                    {user.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          disabled={pending || !selected}
          onClick={addGrant}
        >
          <Plus aria-hidden />
          Grant read
        </Button>
      </div>
    </div>
  );
}
