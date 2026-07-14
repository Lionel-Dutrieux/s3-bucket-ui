"use client";

import { Plus, Trash2, UserRoundPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addGroupMember,
  createGroup,
  deleteGroup,
  removeGroupMember,
} from "@/features/admin/actions";
import type { ActionResult } from "@/lib/action-result";
import type { GroupRow } from "@/lib/dal/groups";
import type { UserOption } from "@/lib/dal/users";

export function GroupsManager({
  groups,
  users,
}: {
  groups: GroupRow[];
  users: UserOption[];
}) {
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<GroupRow | null>(null);
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

  return (
    <div className="space-y-6">
      <form
        className="flex max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          run(
            () => createGroup(name),
            () => setName(""),
          );
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New group name (matches the OIDC groups claim)"
          aria-label="New group name"
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          <Plus aria-hidden />
          Create
        </Button>
      </form>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No groups yet. A group whose name matches a value of the identity
          provider&rsquo;s <code className="font-mono text-xs">groups</code>{" "}
          claim is assigned automatically at sign-in.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              users={users}
              pending={pending}
              onAddMember={(userId) =>
                run(() => addGroupMember(group.id, userId))
              }
              onRemoveMember={(userId) =>
                run(() => removeGroupMember(group.id, userId))
              }
              onDelete={() => setDeleting(group)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`Delete the "${deleting?.name}" group?`}
        description="Its memberships and source grants are removed — members lose whatever access came from this group."
        confirmLabel="Delete group"
        pendingLabel="Deleting…"
        pending={pending}
        onConfirm={() => {
          if (!deleting) return;
          run(
            () => deleteGroup(deleting.id),
            () => setDeleting(null),
          );
        }}
      />
    </div>
  );
}

function GroupCard({
  group,
  users,
  pending,
  onAddMember,
  onRemoveMember,
  onDelete,
}: {
  group: GroupRow;
  users: UserOption[];
  pending: boolean;
  onAddMember: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
  onDelete: () => void;
}) {
  const [selected, setSelected] = useState("");
  const memberIds = new Set(group.members.map((member) => member.userId));
  const candidates = users.filter((user) => !memberIds.has(user.id));

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-semibold">{group.name}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={pending}
          aria-label={`Delete group ${group.name}`}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </header>

      <ul className="mt-3 space-y-1">
        {group.members.length === 0 ? (
          <li className="text-xs text-muted-foreground">No members yet.</li>
        ) : (
          group.members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1 truncate">{member.email}</span>
              {member.via === "oidc" ? (
                <span
                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground"
                  title="Assigned by the identity provider's groups claim"
                >
                  oidc
                </span>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground"
                onClick={() => onRemoveMember(member.userId)}
                disabled={pending}
                aria-label={`Remove ${member.email} from ${group.name}`}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))
        )}
      </ul>

      <div className="mt-3 flex gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="flex-1" aria-label="User to add">
            <SelectValue placeholder="Add a member…" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          disabled={pending || !selected}
          onClick={() => {
            onAddMember(selected);
            setSelected("");
          }}
          aria-label="Add member"
        >
          <UserRoundPlus className="size-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}
