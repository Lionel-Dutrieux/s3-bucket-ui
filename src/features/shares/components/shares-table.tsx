"use client";

import { Copy, Link2Off } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
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
import { formatDate } from "@/lib/format";

export interface ShareRow {
  id: string;
  key: string;
  sourceName: string;
  createdAt: number;
  expiresAt: number | null;
  revoked: boolean;
  downloads: number;
  hasPassword: boolean;
}

function statusOf(share: ShareRow): "active" | "expired" | "revoked" {
  if (share.revoked) return "revoked";
  if (share.expiresAt !== null && share.expiresAt <= Date.now()) {
    return "expired";
  }
  return "active";
}

export function SharesTable({ shares }: { shares: ShareRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const copy = async (id: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/s/${id}`);
    toast.success("Link copied");
  };

  const revoke = (id: string) => {
    startTransition(async () => {
      const result = await revokeShareLink(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Link revoked");
      router.refresh();
    });
  };

  if (shares.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        No share links yet — create one from a file's Share action.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Downloads</TableHead>
            <TableHead>Status</TableHead>
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
                      password-protected
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{share.sourceName}</TableCell>
                <TableCell>{formatDate(share.createdAt)}</TableCell>
                <TableCell>
                  {share.expiresAt === null
                    ? "Never"
                    : formatDate(share.expiresAt)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {share.downloads}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={status === "active" ? "secondary" : "outline"}
                  >
                    {status}
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
                      aria-label={`Copy link to ${name}`}
                      title="Copy link"
                    >
                      <Copy aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => revoke(share.id)}
                      disabled={pending || status === "revoked"}
                      aria-label={`Revoke link to ${name}`}
                      title="Revoke"
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
