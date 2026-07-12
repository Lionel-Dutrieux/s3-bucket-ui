import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ChevronRight, CircleAlert, FolderOpen } from "lucide-react";
import { FileGrid } from "@/features/browser/components/file-grid";
import { FileTable } from "@/features/browser/components/file-table";
import { ViewToggle } from "@/features/browser/components/view-toggle";
import { VIEW_COOKIE, type ViewMode } from "@/features/browser/view";
import { getFilesClient } from "@/features/sources/storage";
import { getSource } from "@/lib/dal/sources";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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

  const segments = prefix.split("/").filter(Boolean);
  const crumbs = segments.map((segment, index) => ({
    label: segment,
    prefix: `${segments.slice(0, index + 1).join("/")}/`,
  }));

  let listError = false;
  let folders: { prefix: string; name: string }[] = [];
  let files: { key: string; name: string; size: number; lastModified?: number }[] = [];
  let nextCursor: string | undefined;

  try {
    const result = await getFilesClient(source).list({
      prefix,
      delimiter: "/",
      cursor,
      limit: 200,
    });
    folders = (result.prefixes ?? [])
      .filter((folderPrefix) => folderPrefix !== prefix)
      .map((folderPrefix) => ({
        prefix: folderPrefix,
        name: folderPrefix.slice(prefix.length).replace(/\/$/, ""),
      }));
    // Skip zero-byte "folder marker" objects created by the R2 dashboard.
    files = result.items
      .filter((item) => item.key !== prefix && !item.key.endsWith("/"))
      .map((item) => ({
        key: item.key,
        name: item.key.slice(prefix.length),
        size: item.size,
        lastModified: item.lastModified,
      }));
    nextCursor = result.cursor;
  } catch {
    listError = true;
  }

  const itemCount = folders.length + files.length;
  const isEmpty = !listError && itemCount === 0;

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <Breadcrumb>
          <BreadcrumbList className="flex-nowrap overflow-x-auto">
            <BreadcrumbItem>
              {crumbs.length === 0 ? (
                <BreadcrumbPage className="text-sm font-medium">
                  {source.name}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={`/source/${source.id}`}>{source.name}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <BreadcrumbItem key={crumb.prefix} className="font-mono text-xs">
                  <BreadcrumbSeparator />
                  {isLast ? (
                    <BreadcrumbPage className="font-mono text-xs">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        href={{
                          pathname: `/source/${source.id}`,
                          query: { prefix: crumb.prefix },
                        }}
                      >
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-3">
          {!listError && !isEmpty ? (
            <span className="text-xs text-muted-foreground tabular-nums max-sm:hidden">
              {itemCount} item{itemCount === 1 ? "" : "s"}
              {nextCursor ? "+" : ""}
            </span>
          ) : null}
          <ViewToggle view={view} />
        </div>
      </header>

      <main className="flex-1">
        {listError ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="flex max-w-sm flex-col items-center gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <CircleAlert className="size-5" aria-hidden />
              </div>
              <h2 className="text-base font-semibold">
                Couldn&apos;t load this folder
              </h2>
              <p className="text-sm text-muted-foreground">
                The bucket didn&apos;t respond. The credentials for this source
                may have been revoked, or the bucket may no longer exist.
              </p>
            </div>
          </div>
        ) : isEmpty ? (
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
        ) : (
          <div className={view === "grid" ? "p-4" : "px-4 py-2"}>
            {view === "grid" ? (
              <FileGrid sourceId={source.id} folders={folders} files={files} />
            ) : (
              <FileTable sourceId={source.id} folders={folders} files={files} />
            )}
            {nextCursor ? (
              <div className="flex justify-center py-4">
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={{
                      pathname: `/source/${source.id}`,
                      query: prefix
                        ? { prefix, cursor: nextCursor }
                        : { cursor: nextCursor },
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
