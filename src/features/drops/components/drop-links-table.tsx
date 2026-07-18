"use client";

import { Copy, Inbox, Link2Off } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { revokeDropLinkAction } from "@/features/drops/actions";
import { copyText } from "@/lib/clipboard";
import { formatDate, formatRelative } from "@/lib/format";

export interface DropLinkRow {
  id: string;
  prefix: string;
  sourceName: string;
  createdAt: number;
  expiresAt: number | null;
  revoked: boolean;
  uploadsCount: number;
  maxFiles: number | null;
  maxSizeMb: number | null;
  hasPassword: boolean;
}

function statusOf(row: DropLinkRow): "active" | "expired" | "revoked" {
  if (row.revoked) return "revoked";
  if (row.expiresAt !== null && row.expiresAt <= Date.now()) return "expired";
  return "active";
}

const STATUS_BADGE: Record<ReturnType<typeof statusOf>, string> = {
  active:
    "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  expired: "border-transparent bg-muted text-muted-foreground",
  revoked: "",
};

export function DropLinksTable({ drops }: { drops: DropLinkRow[] }) {
  const t = useTranslations("drops.management");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const copy = async (id: string) => {
    if (await copyText(`${window.location.origin}/d/${id}`)) {
      toast.success(t("copiedToast"));
    } else {
      toast.error(t("copyFailedToast"));
    }
  };

  const revoke = (id: string) => {
    startTransition(async () => {
      const result = await revokeDropLinkAction({ id });
      if (result.serverError) {
        toast.error(result.serverError);
        return;
      }
      toast.success(t("revokedToast"));
      router.refresh();
    });
  };

  if (drops.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.destination")}</TableHead>
            <TableHead>{t("columns.source")}</TableHead>
            <TableHead>{t("columns.created")}</TableHead>
            <TableHead>{t("columns.expires")}</TableHead>
            <TableHead className="text-right">
              {t("columns.deposits")}
            </TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {drops.map((row) => {
            const status = statusOf(row);
            const name = row.prefix.replace(/\/$/, "").split("/").pop();
            const label = name || t("root");
            return (
              <TableRow key={row.id}>
                <TableCell className="max-w-64">
                  <div className="flex items-center gap-2">
                    <Inbox
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span
                      className="truncate font-medium"
                      title={row.prefix || "/"}
                    >
                      {label}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t("dropLink")}
                    {row.hasPassword ? ` · ${t("passwordProtected")}` : null}
                  </span>
                </TableCell>
                <TableCell>{row.sourceName}</TableCell>
                <TableCell className="text-muted-foreground">
                  <span
                    title={formatDate(row.createdAt, locale)}
                    suppressHydrationWarning
                  >
                    {formatRelative(row.createdAt, locale)}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.expiresAt === null ? (
                    t("never")
                  ) : (
                    <span
                      title={formatDate(row.expiresAt, locale)}
                      suppressHydrationWarning
                    >
                      {formatRelative(row.expiresAt, locale)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.maxFiles === null
                    ? row.uploadsCount
                    : `${row.uploadsCount} / ${row.maxFiles}`}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={status === "revoked" ? "destructive" : "outline"}
                    className={STATUS_BADGE[status]}
                  >
                    {t(`status.${status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => copy(row.id)}
                      disabled={status !== "active"}
                      aria-label={t("copyLinkAria", { name: label })}
                      title={t("copyLinkTitle")}
                    >
                      <Copy aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => revoke(row.id)}
                      disabled={pending || status === "revoked"}
                      aria-label={t("revokeLinkAria", { name: label })}
                      title={t("revokeLinkTitle")}
                    >
                      <Link2Off aria-hidden />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
