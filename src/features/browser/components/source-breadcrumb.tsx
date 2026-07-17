import Link from "next/link";
import { useTranslations } from "next-intl";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildCrumbs } from "@/features/browser/lib/listing";

// The Drive pattern: the path IS the title — no back arrow. Every parent
// segment is a link; deep paths collapse their middle into a "…" menu.
// Desktop keeps the source + last two segments visible; mobile shows one
// "…" menu holding every ancestor next to the current folder.
const VISIBLE_TAIL = 2;

interface PathEntry {
  label: string;
  /** null = the source root (no prefix query). */
  prefix: string | null;
}

function CrumbMenu({
  sourceId,
  entries,
  className,
}: {
  sourceId: string;
  entries: PathEntry[];
  className?: string;
}) {
  const t = useTranslations("browser.breadcrumb");
  return (
    <BreadcrumbItem className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center rounded-md px-0.5 hover:text-foreground"
          aria-label={t("showParentFolders")}
        >
          <BreadcrumbEllipsis className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {entries.map((entry) => (
            <DropdownMenuItem key={entry.prefix ?? ""} asChild>
              <Link
                href={{
                  pathname: `/source/${sourceId}`,
                  query: entry.prefix ? { prefix: entry.prefix } : undefined,
                }}
              >
                {entry.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </BreadcrumbItem>
  );
}

export function SourceBreadcrumb({
  sourceId,
  sourceName,
  prefix,
}: {
  sourceId: string;
  sourceName: string;
  prefix: string;
}) {
  const crumbs = buildCrumbs(prefix);
  const collapsed =
    crumbs.length > VISIBLE_TAIL ? crumbs.slice(0, -VISIBLE_TAIL) : [];
  const tail = crumbs.slice(collapsed.length);
  // Mobile: everything above the current folder, source included.
  const ancestors: PathEntry[] = [
    { label: sourceName, prefix: null },
    ...crumbs.slice(0, -1),
  ];

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap text-base">
        {/* The current folder's own separator follows below — no extra one. */}
        {crumbs.length > 0 ? (
          <CrumbMenu
            sourceId={sourceId}
            entries={ancestors}
            className="sm:hidden"
          />
        ) : null}

        <BreadcrumbItem className="min-w-0 max-sm:hidden">
          {crumbs.length === 0 ? (
            <BreadcrumbPage className="truncate font-semibold">
              {sourceName}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild className="min-w-0">
              <Link href={`/source/${sourceId}`} className="max-w-40 truncate">
                {sourceName}
              </Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {/* At the root, mobile shows the plain source name (no menu). */}
        {crumbs.length === 0 ? (
          <BreadcrumbItem className="min-w-0 sm:hidden">
            <BreadcrumbPage className="truncate font-semibold">
              {sourceName}
            </BreadcrumbPage>
          </BreadcrumbItem>
        ) : null}

        {collapsed.length > 0 ? (
          <>
            <BreadcrumbSeparator className="max-sm:hidden" />
            <CrumbMenu
              sourceId={sourceId}
              entries={collapsed}
              className="max-sm:hidden"
            />
          </>
        ) : null}

        {tail.map((crumb, index) => {
          const isLast = index === tail.length - 1;
          const hiddenOnMobile = !isLast ? "max-sm:hidden" : undefined;
          return (
            <Fragment key={crumb.prefix}>
              <BreadcrumbSeparator className={hiddenOnMobile} />
              <BreadcrumbItem className={`min-w-0 ${hiddenOnMobile ?? ""}`}>
                {isLast ? (
                  <BreadcrumbPage className="truncate font-semibold">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="min-w-0">
                    <Link
                      href={{
                        pathname: `/source/${sourceId}`,
                        query: { prefix: crumb.prefix },
                      }}
                      className="max-w-40 truncate"
                    >
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
