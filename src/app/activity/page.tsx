import type { Metadata } from "next";
import { History } from "lucide-react";
import { operationLabel } from "@/features/browser/operation-labels";
import { listOperations } from "@/lib/dal/operations";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const operations = await listOperations();

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-sm font-medium">Activity</h1>
        {operations.length > 0 ? (
          <span className="text-xs text-muted-foreground tabular-nums max-sm:hidden">
            last {operations.length} write
            {operations.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </header>

      <main className="flex-1">
        {operations.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="p-4 pt-3">
            <p className="mb-3 text-xs text-muted-foreground">
              Every upload, deletion and rename across all sources. Read actions
              (browsing, downloads, previews) aren&rsquo;t recorded.
            </p>
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
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <History className="size-5" aria-hidden />
        </div>
        <h2 className="text-base font-semibold">No activity yet</h2>
        <p className="text-sm text-muted-foreground">
          Uploads, deletions and renames will show up here as they happen.
        </p>
      </div>
    </div>
  );
}
