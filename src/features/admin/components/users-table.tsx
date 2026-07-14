"use client";

import {
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  banUser,
  removeUser,
  setUserRole,
  unbanUser,
} from "@/features/admin/actions";
import type { ActionResult } from "@/lib/action-result";
import type { UserRow } from "@/lib/dal/users";
import { formatDateTime } from "@/lib/format";

function initialsOf(name: string): string {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

/** Menu actions that change what an account can do all confirm first —
 * promoting, banning and deleting are one mis-click apart in the dropdown. */
type PendingAction = { kind: "role" | "ban" | "delete"; user: UserRow };

function confirmCopyFor(action: PendingAction) {
  const { kind, user } = action;
  if (kind === "role") {
    return user.role === "admin"
      ? {
          title: `Remove admin rights from ${user.email}?`,
          description:
            "They keep their account but only see sources they hold a grant on.",
          confirmLabel: "Make user",
          pendingLabel: "Updating…",
          destructive: false,
        }
      : {
          title: `Make ${user.email} an admin?`,
          description:
            "Admins see every source, manage accounts and grants, and read the audit log.",
          confirmLabel: "Make admin",
          pendingLabel: "Updating…",
          destructive: false,
        };
  }
  if (kind === "ban") {
    return {
      title: `Ban ${user.email}?`,
      description:
        "They are signed out everywhere and can no longer sign in until unbanned.",
      confirmLabel: "Ban user",
      pendingLabel: "Banning…",
      destructive: true,
    };
  }
  return {
    title: `Delete ${user.email}?`,
    description:
      "Their account, sessions and grants are permanently deleted. Their past activity stays in the audit log.",
    confirmLabel: "Delete user",
    pendingLabel: "Deleting…",
    destructive: true,
  };
}

export function UsersTable({
  users,
  selfId,
}: {
  users: UserRow[];
  selfId: string;
}) {
  const [confirming, setConfirming] = useState<PendingAction | null>(null);
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
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>User</TableHead>
            <TableHead className="w-28">Role</TableHead>
            <TableHead className="max-lg:hidden">Groups</TableHead>
            <TableHead className="w-44 max-md:hidden">Joined</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <span className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold">
                    {initialsOf(user.name)}
                  </span>
                  <span className="grid min-w-0 leading-tight">
                    <span className="truncate text-sm font-medium">
                      {user.name}
                      {user.id === selfId ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      ) : null}
                      {user.banned ? (
                        <span className="ml-1.5 rounded-md border border-destructive/20 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                          banned
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </span>
                </span>
              </TableCell>
              <TableCell>
                {user.role === "admin" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <ShieldCheck className="size-3.5" aria-hidden />
                    Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    <UserRound className="size-3.5" aria-hidden />
                    User
                  </span>
                )}
              </TableCell>
              <TableCell className="max-lg:hidden">
                {user.groups.length === 0 ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {user.groups.map((group) => (
                      <span
                        key={group}
                        className="rounded-md border bg-muted/50 px-1.5 py-0.5 text-xs"
                      >
                        {group}
                      </span>
                    ))}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground tabular-nums max-md:hidden">
                {formatDateTime(user.createdAt)}
              </TableCell>
              <TableCell>
                {user.id === selfId ? null : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={pending}
                        aria-label={`Actions for ${user.email}`}
                      >
                        <MoreHorizontal className="size-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => setConfirming({ kind: "role", user })}
                      >
                        <ShieldCheck aria-hidden />
                        {user.role === "admin" ? "Make user" : "Make admin"}
                      </DropdownMenuItem>
                      {user.banned ? (
                        // Unbanning restores access — no confirmation needed.
                        <DropdownMenuItem
                          onSelect={() => run(() => unbanUser(user.id))}
                        >
                          <ShieldOff aria-hidden />
                          Unban
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onSelect={() => setConfirming({ kind: "ban", user })}
                        >
                          <ShieldOff aria-hidden />
                          Ban
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setConfirming({ kind: "delete", user })}
                      >
                        <Trash2 aria-hidden />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirming(null);
        }}
        {...(confirming
          ? confirmCopyFor(confirming)
          : {
              title: "",
              description: "",
              confirmLabel: "Confirm",
            })}
        pending={pending}
        onConfirm={() => {
          if (!confirming) return;
          const { kind, user } = confirming;
          run(
            () =>
              kind === "role"
                ? setUserRole(user.id, user.role === "admin" ? "user" : "admin")
                : kind === "ban"
                  ? banUser(user.id)
                  : removeUser(user.id),
            () => setConfirming(null),
          );
        }}
      />
    </>
  );
}
