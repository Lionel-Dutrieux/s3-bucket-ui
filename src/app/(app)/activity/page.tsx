import { History } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { operationLabel } from "@/features/browser/lib/operation-labels";
import { requireAdmin } from "@/lib/auth/session";
import { listOperations } from "@/lib/dal/operations";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  // Admin-only: the journal spans all sources, including ones a regular user
  // was never granted.
  await requireAdmin();
  const operations = await listOperations();

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-sm font-medium">Activity</h1>
      </header>

      <main className="flex-1 bg-muted/20">
        <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-6">
          <PageHeader
            title="Activity"
            description="Every upload, deletion, rename and move across all sources, attributed to the signed-in user. Read actions aren't recorded."
          >
            {operations.length > 0 ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                last {operations.length} write
                {operations.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </PageHeader>

          {operations.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-44">Action</TableHead>
                    <TableHead className="w-40">Source</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="w-44">When</TableHead>
                    <TableHead className="w-40">By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operations.map((operation) => {
                    const {
                      label,
                      icon: Icon,
                      destructive,
                    } = operationLabel(operation.action);
                    return (
                      <TableRow key={operation.id}>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <Icon
                              className={cn(
                                "size-4 shrink-0",
                                destructive
                                  ? "text-destructive"
                                  : "text-muted-foreground",
                              )}
                              aria-hidden
                            />
                            <span className="font-medium">{label}</span>
                          </span>
                        </TableCell>
                        <TableCell className="truncate text-muted-foreground">
                          {operation.sourceName}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <span className="block truncate">
                            {operation.target}
                          </span>
                          {operation.detail ? (
                            <span className="block truncate text-muted-foreground">
                              {operation.detail}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {formatDateTime(operation.createdAt)}
                        </TableCell>
                        <TableCell className="truncate text-xs text-muted-foreground">
                          {operation.actor ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <History className="size-5" aria-hidden />
      </div>
      <h2 className="text-base font-semibold">No activity yet</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Uploads, deletions, renames and moves will show up here as they happen.
      </p>
    </div>
  );
}
