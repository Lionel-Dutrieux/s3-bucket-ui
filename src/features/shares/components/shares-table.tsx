"use client";

import { Copy, Link2, Link2Off } from "lucide-react";
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
import { revokeShareLink } from "@/features/shares/actions";
import { copyText } from "@/lib/clipboard";
import { formatDate, formatRelative } from "@/lib/format";

export interface ShareRow {
  id: string;
  key: string;
  sourceName: string;
  createdAt: number;
  expiresAt: number | null;
  revoked: boolean;
  downloads: number;
  maxDownloads: number | null;
  hasPassword: boolean;
}

function statusOf(
  share: ShareRow,
): "active" | "expired" | "exhausted" | "revoked" {
  if (share.revoked) return "revoked";
  if (share.expiresAt !== null && share.expiresAt <= Date.now()) {
    return "expired";
  }
  if (share.maxDownloads !== null && share.downloads >= share.maxDownloads) {
    return "exhausted";
  }
  return "active";
}

// A live link reads green, a lapsed one grey, an exhausted one amber, a killed
// one red — the status is scannable without reading the words.
const STATUS_BADGE: Record<ReturnType<typeof statusOf>, string> = {
  active:
    "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  expired: "border-transparent bg-muted text-muted-foreground",
  exhausted:
    "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  revoked: "",
};

export function SharesTable({ shares }: { shares: ShareRow[] }) {
  const t = useTranslations("shares");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const copy = async (id: string) => {
    if (await copyText(`${window.location.origin}/s/${id}`)) {
      toast.success(t("copiedToast"));
    } else {
      toast.error(t("copyFailedToast"));
    }
  };

  const revoke = (id: string) => {
    startTransition(async () => {
      const result = await revokeShareLink(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("revokedToast"));
      router.refresh();
    });
  };

  if (shares.length === 0) {
    return (
      <EmptyState
        icon={Link2}
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
            <TableHead>{t("columns.file")}</TableHead>
            <TableHead>{t("columns.source")}</TableHead>
            <TableHead>{t("columns.created")}</TableHead>
            <TableHead>{t("columns.expires")}</TableHead>
            <TableHead className="text-right">
              {t("columns.downloads")}
            </TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shares.map((share) => {
            const status = statusOf(share);
            const name = share.key.split("/").pop() || share.key;
            return (
              <TableRow key={share.id}>
                <TableCell className="max-w-64">
                  <span
                    className="block truncate font-medium"
                    title={share.key}
                  >
                    {name}
                  </span>
                  {share.hasPassword ? (
                    <span className="text-xs text-muted-foreground">
                      {t("passwordProtected")}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{share.sourceName}</TableCell>
                <TableCell className="text-muted-foreground">
                  <span
                    title={formatDate(share.createdAt, locale)}
                    suppressHydrationWarning
                  >
                    {formatRelative(share.createdAt, locale)}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {share.expiresAt === null ? (
                    t("never")
                  ) : (
                    <span
                      title={formatDate(share.expiresAt, locale)}
                      suppressHydrationWarning
                    >
                      {formatRelative(share.expiresAt, locale)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {share.maxDownloads === null ? (
                    share.downloads
                  ) : (
                    <span
                      className={
                        status === "exhausted"
                          ? "font-medium text-amber-700 dark:text-amber-400"
                          : undefined
                      }
                      title={t("downloadsOfMax", {
                        count: share.downloads,
                        max: share.maxDownloads,
                      })}
                    >
                      {share.downloads} / {share.maxDownloads}
                    </span>
                  )}
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
                      onClick={() => copy(share.id)}
                      disabled={status !== "active"}
                      aria-label={t("copyLinkAria", { name })}
                      title={t("copyLinkTitle")}
                    >
                      <Copy aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => revoke(share.id)}
                      disabled={pending || status === "revoked"}
                      aria-label={t("revokeLinkAria", { name })}
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
