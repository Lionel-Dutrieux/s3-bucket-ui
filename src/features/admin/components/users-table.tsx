"use client";

import {
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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

type UsersTableT = ReturnType<typeof useTranslations>;

function confirmCopyFor(action: PendingAction, t: UsersTableT) {
  const { kind, user } = action;
  if (kind === "role") {
    return user.role === "admin"
      ? {
          title: t("confirmRemoveAdminTitle", { email: user.email }),
          description: t("confirmRemoveAdminDescription"),
          confirmLabel: t("makeUser"),
          pendingLabel: t("confirmRoleUpdating"),
          destructive: false,
        }
      : {
          title: t("confirmMakeAdminTitle", { email: user.email }),
          description: t("confirmMakeAdminDescription"),
          confirmLabel: t("makeAdmin"),
          pendingLabel: t("confirmRoleUpdating"),
          destructive: false,
        };
  }
  if (kind === "ban") {
    return {
      title: t("confirmBanTitle", { email: user.email }),
      description: t("confirmBanDescription"),
      confirmLabel: t("confirmBanLabel"),
      pendingLabel: t("confirmBanning"),
      destructive: true,
    };
  }
  return {
    title: t("confirmDeleteTitle", { email: user.email }),
    description: t("confirmDeleteDescription"),
    confirmLabel: t("confirmDeleteLabel"),
    pendingLabel: t("confirmDeleting"),
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
  const t = useTranslations("admin.usersTable");
  const tCommon = useTranslations("common");

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
            <TableHead>{t("userColumn")}</TableHead>
            <TableHead className="w-28">{t("roleColumn")}</TableHead>
            <TableHead className="max-lg:hidden">{t("groupsColumn")}</TableHead>
            <TableHead className="w-44 max-md:hidden">
              {t("joinedColumn")}
            </TableHead>
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
                          {t("you")}
                        </span>
                      ) : null}
                      {user.banned ? (
                        <span className="ml-1.5 rounded-md border border-destructive/20 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                          {t("banned")}
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
                    {t("admin")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    <UserRound className="size-3.5" aria-hidden />
                    {t("user")}
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
                        aria-label={t("actionsFor", { email: user.email })}
                      >
                        <MoreHorizontal className="size-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => setConfirming({ kind: "role", user })}
                      >
                        <ShieldCheck aria-hidden />
                        {user.role === "admin" ? t("makeUser") : t("makeAdmin")}
                      </DropdownMenuItem>
                      {user.banned ? (
                        // Unbanning restores access — no confirmation needed.
                        <DropdownMenuItem
                          onSelect={() => run(() => unbanUser(user.id))}
                        >
                          <ShieldOff aria-hidden />
                          {t("unban")}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onSelect={() => setConfirming({ kind: "ban", user })}
                        >
                          <ShieldOff aria-hidden />
                          {t("ban")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setConfirming({ kind: "delete", user })}
                      >
                        <Trash2 aria-hidden />
                        {t("delete")}
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
          ? confirmCopyFor(confirming, t)
          : {
              title: "",
              description: "",
              confirmLabel: tCommon("confirm"),
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
