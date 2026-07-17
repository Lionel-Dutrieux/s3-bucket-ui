import { Download, History } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { AppHeader, PageContainer } from "@/components/layout/app-header";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
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
import {
  listOperationSourceNames,
  listOperations,
  purgeExpiredOperations,
} from "@/lib/dal/operations";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("activity");
  return { title: t("metaTitle") };
}

interface ActivityPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ActivityPage({
  searchParams,
}: ActivityPageProps) {
  // Admin-only: the journal spans all sources, including ones a regular user
  // was never granted.
  await requireAdmin();
  // Lazy retention purge: fast (throttled to 1×/day) and never throws, so the
  // freshly-listed data below already reflects it.
  await purgeExpiredOperations();
  const t = await getTranslations("activity");

  const sp = await searchParams;
  const action = typeof sp.action === "string" ? sp.action : undefined;
  const sourceName = typeof sp.source === "string" ? sp.source : undefined;
  const q = typeof sp.q === "string" ? sp.q : "";
  const hasFilters = Boolean(action || sourceName || q);

  const [operations, sourceNames] = await Promise.all([
    listOperations({ action, sourceName, q: q || undefined }),
    listOperationSourceNames(),
  ]);

  const exportQuery = new URLSearchParams();
  if (action) exportQuery.set("action", action);
  if (sourceName) exportQuery.set("source", sourceName);
  if (q) exportQuery.set("q", q);
  const exportParams = exportQuery.toString();
  const exportHref = (format: "csv" | "json") =>
    `/api/activity/export?format=${format}${exportParams ? `&${exportParams}` : ""}`;

  return (
    <>
      <AppHeader title={t("headerTitle")} />

      <PageContainer>
        {/* "Activity log", not "Activity": the sticky header above already
            carries the nav label — stacking the same word twice reads odd. */}
        <PageHeader title={t("title")} description={t("description")}>
          {operations.length > 0 ? (
            <span className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("entryCount", { count: operations.length })}
              </span>
              <a
                href={exportHref("csv")}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Download aria-hidden />
                {t("exportCsv")}
              </a>
              <a
                href={exportHref("json")}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Download aria-hidden />
                {t("exportJson")}
              </a>
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
              title={t("emptyFilteredTitle")}
              description={t("emptyFilteredDescription")}
            />
          ) : (
            <EmptyState
              icon={History}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          )
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {/* Fixed layout so long object keys truncate instead of
                  stretching the table into a horizontal scroll. */}
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-40">{t("columns.action")}</TableHead>
                  <TableHead className="w-36 max-lg:hidden">
                    {t("columns.source")}
                  </TableHead>
                  <TableHead>{t("columns.target")}</TableHead>
                  <TableHead className="w-40 max-md:hidden">
                    {t("columns.when")}
                  </TableHead>
                  <TableHead className="w-40 max-md:hidden">
                    {t("columns.by")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations.map((operation) => {
                  const {
                    labelKey,
                    icon: Icon,
                    destructive,
                  } = operationLabel(operation.action);
                  const label = labelKey
                    ? t(`operations.${labelKey}`)
                    : operation.action;
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
