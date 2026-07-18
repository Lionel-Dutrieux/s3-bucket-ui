import { ChevronRight, CircleAlert, ListFilter } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { FileBrowser } from "@/features/browser/components/file-browser";
import { SourceBreadcrumb } from "@/features/browser/components/source-breadcrumb";
import { categoryOf, FILE_CATEGORIES } from "@/features/browser/lib/file-types";
import { VIEW_COOKIE, type ViewMode } from "@/features/browser/lib/view";
import {
  type ListErrorReason,
  listFolder,
} from "@/features/browser/server/service";
import { requireSourceAccess } from "@/lib/auth/access";
import { isPublicSharingEnabled } from "@/lib/dal/settings";

interface SourcePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({
  params,
}: SourcePageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await requireSourceAccess(id);
  const t = await getTranslations("browser.page");
  return { title: result?.source.name ?? t("metaFallbackTitle") };
}

export default async function SourcePage({
  params,
  searchParams,
}: SourcePageProps) {
  const { id } = await params;
  const t = await getTranslations("browser.page");
  const fileTypeT = await getTranslations("browser.fileTypes");
  const sp = await searchParams;
  const prefix = typeof sp.prefix === "string" ? sp.prefix : "";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const activeType = FILE_CATEGORIES.find((c) => c.id === sp.type)?.id;

  // Uniform notFound() whether the source doesn't exist or the user simply
  // has no grant on it — its existence is not revealed.
  const result = await requireSourceAccess(id);
  if (!result) notFound();
  const { source, access } = result;

  const view: ViewMode =
    (await cookies()).get(VIEW_COOKIE)?.value === "grid" ? "grid" : "list";

  // Sharing is app-minted now (streaming fallback covers unsigned providers),
  // so the only gate is the instance-wide switch in Admin → Settings.
  const canShare = await isPublicSharingEnabled();

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
        <SourceBreadcrumb
          sourceId={source.id}
          sourceName={source.name}
          prefix={prefix}
        />
        {/* Display controls (type / sort / view) live in the browser toolbar,
            next to each other — the header only states where you are and how
            much is here. */}
        {itemCount > 0 ? (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums max-sm:hidden">
            {t("itemCount", { count: itemCount })}
            {listing.ok && listing.nextCursor ? "+" : ""}
          </span>
        ) : null}
      </header>

      <main className="flex-1">
        {!listing.ok ? (
          <ErrorState reason={listing.reason} />
        ) : isEmpty && activeType ? (
          <FilteredEmptyState
            sourceId={source.id}
            prefix={prefix}
            typeLabel={activeType ? fileTypeT(activeType) : ""}
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
                upload: access.canEdit,
                delete: access.canDelete,
              }}
              canShare={canShare}
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
                    {t("nextPage")}
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

async function errorCopy(
  reason: ListErrorReason,
): Promise<{ title: string; body: string }> {
  const t = await getTranslations("browser.errors");
  const copy: Record<ListErrorReason, { title: string; body: string }> = {
    credentials: {
      title: t("credentialsTitle"),
      body: t("credentialsBody"),
    },
    "bucket-missing": {
      title: t("bucketMissingTitle"),
      body: t("bucketMissingBody"),
    },
    network: {
      title: t("networkTitle"),
      body: t("networkBody"),
    },
    unknown: {
      title: t("unknownTitle"),
      body: t("unknownBody"),
    },
  };
  return copy[reason];
}

async function ErrorState({ reason }: { reason: ListErrorReason }) {
  const copy = await errorCopy(reason);
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

async function FilteredEmptyState({
  sourceId,
  prefix,
  typeLabel,
}: {
  sourceId: string;
  prefix: string;
  typeLabel: string;
}) {
  const t = await getTranslations("browser.filteredEmpty");
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <ListFilter className="size-5" aria-hidden />
        </div>
        <h2 className="text-base font-semibold">
          {t("title", { type: typeLabel.toLowerCase() })}
        </h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <Button variant="outline" size="sm" asChild className="mt-1">
          <Link
            href={{
              pathname: `/source/${sourceId}`,
              query: prefix ? { prefix } : undefined,
            }}
          >
            {t("clearFilter")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
