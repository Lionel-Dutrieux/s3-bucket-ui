import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ChevronRight, CircleAlert, FolderOpen } from "lucide-react";
import { FileGrid } from "@/features/browser/components/file-grid";
import { FileTable } from "@/features/browser/components/file-table";
import { SourceBreadcrumb } from "@/features/browser/components/source-breadcrumb";
import { ViewToggle } from "@/features/browser/components/view-toggle";
import { listFolder } from "@/features/browser/service";
import { VIEW_COOKIE, type ViewMode } from "@/features/browser/view";
import { getSource } from "@/lib/dal/sources";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface SourcePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({
  params,
}: SourcePageProps): Promise<Metadata> {
  const { id } = await params;
  const source = await getSource(id);
  return { title: source?.name ?? "Source" };
}

export default async function SourcePage({
  params,
  searchParams,
}: SourcePageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const prefix = typeof sp.prefix === "string" ? sp.prefix : "";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;

  const source = await getSource(id);
  if (!source) notFound();

  const view: ViewMode =
    (await cookies()).get(VIEW_COOKIE)?.value === "grid" ? "grid" : "list";

  const listing = await listFolder(source, prefix, cursor);
  const itemCount = listing
    ? listing.folders.length + listing.files.length
    : 0;
  const isEmpty = listing !== null && itemCount === 0;

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <SourceBreadcrumb
          sourceId={source.id}
          sourceName={source.name}
          prefix={prefix}
        />
        <div className="ml-auto flex items-center gap-3">
          {itemCount > 0 ? (
            <span className="text-xs text-muted-foreground tabular-nums max-sm:hidden">
              {itemCount} item{itemCount === 1 ? "" : "s"}
              {listing?.nextCursor ? "+" : ""}
            </span>
          ) : null}
          <ViewToggle view={view} />
        </div>
      </header>

      <main className="flex-1">
        {listing === null ? (
          <ErrorState />
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <div className={view === "grid" ? "p-4" : "px-4 py-2"}>
            {view === "grid" ? (
              <FileGrid
                sourceId={source.id}
                folders={listing.folders}
                files={listing.files}
              />
            ) : (
              <FileTable
                sourceId={source.id}
                folders={listing.folders}
                files={listing.files}
              />
            )}
            {listing.nextCursor ? (
              <div className="flex justify-center py-4">
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={{
                      pathname: `/source/${source.id}`,
                      query: prefix
                        ? { prefix, cursor: listing.nextCursor }
                        : { cursor: listing.nextCursor },
                    }}
                  >
                    Next page
                    <ChevronRight aria-hidden />
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </>
  );
}

function ErrorState() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <CircleAlert className="size-5" aria-hidden />
        </div>
        <h2 className="text-base font-semibold">Couldn&apos;t load this folder</h2>
        <p className="text-sm text-muted-foreground">
          The bucket didn&apos;t respond. The credentials for this source may
          have been revoked, or the bucket may no longer exist.
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <FolderOpen className="size-5" aria-hidden />
        </div>
        <h2 className="text-base font-semibold">This folder is empty</h2>
        <p className="text-sm text-muted-foreground">
          Files uploaded to this location will show up here.
        </p>
      </div>
    </div>
  );
}
