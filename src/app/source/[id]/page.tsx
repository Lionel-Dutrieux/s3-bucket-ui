import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, CircleAlert, ListFilter } from "lucide-react";
import { FileBrowser } from "@/features/browser/components/file-browser";
import { SourceBreadcrumb } from "@/features/browser/components/source-breadcrumb";
import { TypeFilter } from "@/features/browser/components/type-filter";
import { ViewToggle } from "@/features/browser/components/view-toggle";
import { categoryOf, FILE_CATEGORIES } from "@/features/browser/lib/file-types";
import {
  listFolder,
  type ListErrorReason,
} from "@/features/browser/server/service";
import { VIEW_COOKIE, type ViewMode } from "@/features/browser/lib/view";
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
  const activeType = FILE_CATEGORIES.find((c) => c.id === sp.type)?.id;

  const source = await getSource(id);
  if (!source) notFound();

  const view: ViewMode =
    (await cookies()).get(VIEW_COOKIE)?.value === "grid" ? "grid" : "list";

  const listing = await listFolder(source, prefix, cursor);
  // An active type filter hides folders and keeps only matching files.
  const folders = !listing.ok || activeType ? [] : listing.folders;
  const files = !listing.ok
    ? []
    : activeType
      ? listing.files.filter((file) => categoryOf(file.name) === activeType)
      : listing.files;
  const itemCount = folders.length + files.length;
  const isEmpty = listing.ok && itemCount === 0;

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        {prefix ? <UpButton sourceId={source.id} prefix={prefix} /> : null}
        <SourceBreadcrumb
          sourceId={source.id}
          sourceName={source.name}
          prefix={prefix}
        />
        <div className="ml-auto flex items-center gap-2">
          {itemCount > 0 ? (
            <span className="text-xs text-muted-foreground tabular-nums max-sm:hidden">
              {itemCount} item{itemCount === 1 ? "" : "s"}
              {listing.ok && listing.nextCursor ? "+" : ""}
            </span>
          ) : null}
          {listing.ok ? <TypeFilter active={activeType} /> : null}
          <ViewToggle view={view} />
        </div>
      </header>

      <main className="flex-1">
        {!listing.ok ? (
          <ErrorState reason={listing.reason} />
        ) : isEmpty && activeType ? (
          <FilteredEmptyState
            sourceId={source.id}
            prefix={prefix}
            typeLabel={
              FILE_CATEGORIES.find((c) => c.id === activeType)?.label ?? ""
            }
          />
        ) : (
          <div className="p-4 pt-3">
            <FileBrowser
              sourceId={source.id}
              prefix={prefix}
              folders={folders}
              files={files}
              view={view}
              permissions={{
                upload: source.allowUpload,
                delete: source.allowDelete,
              }}
            />
            {listing.nextCursor ? (
              <div className="flex justify-center py-4">
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={{
                      pathname: `/source/${source.id}`,
                      query: {
                        ...(prefix ? { prefix } : {}),
                        ...(activeType ? { type: activeType } : {}),
                        cursor: listing.nextCursor,
                      },
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

function UpButton({ sourceId, prefix }: { sourceId: string; prefix: string }) {
  const segments = prefix.split("/").filter(Boolean);
  const parentPrefix =
    segments.length > 1 ? `${segments.slice(0, -1).join("/")}/` : "";

  return (
    <Button variant="ghost" size="icon" className="size-7 shrink-0" asChild>
      <Link
        href={{
          pathname: `/source/${sourceId}`,
          query: parentPrefix ? { prefix: parentPrefix } : undefined,
        }}
        aria-label="Up one level"
        title="Up one level"
      >
        <ArrowLeft className="size-4" aria-hidden />
      </Link>
    </Button>
  );
}

const ERROR_COPY: Record<ListErrorReason, { title: string; body: string }> = {
  credentials: {
    title: "Access denied",
    body: "The bucket rejected the credentials for this source. They may have been rotated or revoked — edit the source to update them.",
  },
  "bucket-missing": {
    title: "Bucket not found",
    body: "The bucket this source points to doesn't exist anymore. It may have been renamed or deleted — edit the source to fix the bucket name.",
  },
  network: {
    title: "Endpoint unreachable",
    body: "The endpoint didn't respond. Check the endpoint URL on this source, or your network connection.",
  },
  unknown: {
    title: "Couldn't load this folder",
    body: "The bucket returned an unexpected error. Details were written to the server logs.",
  },
};

function ErrorState({ reason }: { reason: ListErrorReason }) {
  const copy = ERROR_COPY[reason];
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <CircleAlert className="size-5" aria-hidden />
        </div>
        <h2 className="text-base font-semibold">{copy.title}</h2>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
      </div>
    </div>
  );
}

function FilteredEmptyState({
  sourceId,
  prefix,
  typeLabel,
}: {
  sourceId: string;
  prefix: string;
  typeLabel: string;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <ListFilter className="size-5" aria-hidden />
        </div>
        <h2 className="text-base font-semibold">
          No {typeLabel.toLowerCase()} in this folder
        </h2>
        <p className="text-sm text-muted-foreground">
          Nothing at this level matches the filter.
        </p>
        <Button variant="outline" size="sm" asChild className="mt-1">
          <Link
            href={{
              pathname: `/source/${sourceId}`,
              query: prefix ? { prefix } : undefined,
            }}
          >
            Clear filter
          </Link>
        </Button>
      </div>
    </div>
  );
}
