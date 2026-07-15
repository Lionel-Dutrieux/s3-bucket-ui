import { History } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { AppHeader, PageContainer } from "@/components/layout/app-header";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActivityFilters } from "@/features/activity/components/activity-filters";
import { operationLabel } from "@/features/activity/lib/operation-labels";
import { requireAdmin } from "@/lib/auth/session";
import { listOperationSourceNames, listOperations } from "@/lib/dal/operations";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Activity" };

interface ActivityPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ActivityPage({
  searchParams,
}: ActivityPageProps) {
  // Admin-only: the journal spans all sources, including ones a regular user
  // was never granted.
  await requireAdmin();

  const sp = await searchParams;
  const action = typeof sp.action === "string" ? sp.action : undefined;
  const sourceName = typeof sp.source === "string" ? sp.source : undefined;
  const q = typeof sp.q === "string" ? sp.q : "";
  const hasFilters = Boolean(action || sourceName || q);

  const [operations, sourceNames] = await Promise.all([
    listOperations({ action, sourceName, q: q || undefined }),
    listOperationSourceNames(),
  ]);

  return (
    <>
      <AppHeader title="Activity" />

      <PageContainer>
        {/* "Activity log", not "Activity": the sticky header above already
            carries the nav label — stacking the same word twice reads odd. */}
        <PageHeader
          title="Activity log"
          description="Every write across all sources — uploads, deletions, renames, moves and shares. Reads aren't recorded."
        >
          {operations.length > 0 ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {operations.length} entr{operations.length === 1 ? "y" : "ies"}
            </span>
          ) : null}
        </PageHeader>

        <ActivityFilters
          action={action}
          sourceName={sourceName}
          q={q}
          sourceNames={sourceNames}
        />

        {operations.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={History}
              title="No matching activity"
              description="Nothing in the log matches these filters — clear them to see everything."
            />
          ) : (
            <EmptyState
              icon={History}
              title="No activity yet"
              description="Uploads, deletions, renames and moves will show up here as they happen."
            />
          )
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {/* Fixed layout so long object keys truncate instead of
                  stretching the table into a horizontal scroll. */}
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-40">Action</TableHead>
                  <TableHead className="w-36 max-lg:hidden">Source</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="w-40 max-md:hidden">When</TableHead>
                  <TableHead className="w-40 max-md:hidden">By</TableHead>
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
                      <TableCell className="truncate text-muted-foreground max-lg:hidden">
                        {operation.sourceName}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <span
                          className="block truncate"
                          title={operation.target}
                        >
                          {operation.target}
                        </span>
                        {operation.detail ? (
                          <span
                            className="block truncate text-muted-foreground"
                            title={operation.detail}
                          >
                            {operation.detail}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums max-md:hidden">
                        <span title={formatDateTime(operation.createdAt)}>
                          {formatRelative(operation.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="truncate text-xs text-muted-foreground max-md:hidden">
                        {operation.actor ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </PageContainer>
    </>
  );
}
