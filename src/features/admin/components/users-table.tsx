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

export function UsersTable({
  users,
  selfId,
}: {
  users: UserRow[];
  selfId: string;
}) {
  const [removing, setRemoving] = useState<UserRow | null>(null);
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
            <TableHead>Groups</TableHead>
            <TableHead className="w-44">Joined</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <p className="truncate text-sm font-medium">
                  {user.name}
                  {user.id === selfId ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      (you)
                    </span>
                  ) : null}
                  {user.banned ? (
                    <span className="ml-1.5 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                      banned
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5 text-sm">
                  {user.role === "admin" ? (
                    <>
                      <ShieldCheck
                        className="size-4 text-amber-600"
                        aria-hidden
                      />
                      Admin
                    </>
                  ) : (
                    <>
                      <UserRound
                        className="size-4 text-muted-foreground"
                        aria-hidden
                      />
                      User
                    </>
                  )}
                </span>
              </TableCell>
              <TableCell>
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
              <TableCell className="text-xs text-muted-foreground tabular-nums">
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
                        onSelect={() =>
                          run(() =>
                            setUserRole(
                              user.id,
                              user.role === "admin" ? "user" : "admin",
                            ),
                          )
                        }
                      >
                        <ShieldCheck aria-hidden />
                        {user.role === "admin" ? "Make user" : "Make admin"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          run(() =>
                            user.banned ? unbanUser(user.id) : banUser(user.id),
                          )
                        }
                      >
                        <ShieldOff aria-hidden />
                        {user.banned ? "Unban" : "Ban"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setRemoving(user)}
                      >
                        <Trash2 aria-hidden />
                        Remove
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
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={`Remove ${removing?.email}?`}
        description="Their account, sessions and grants are permanently deleted. Their past activity stays in the audit log."
        confirmLabel="Remove user"
        pendingLabel="Removing…"
        pending={pending}
        onConfirm={() => {
          if (!removing) return;
          run(
            () => removeUser(removing.id),
            () => setRemoving(null),
          );
        }}
      />
    </>
  );
}
