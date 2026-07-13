import Link from "next/link";
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
import { buildCrumbs } from "@/features/browser/lib/listing";

// Desktop: full path. Mobile: source / … / current folder, truncated.
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
  const hasHiddenCrumbs = crumbs.length > 1;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="min-w-0">
          {crumbs.length === 0 ? (
            <BreadcrumbPage className="truncate text-sm font-medium">
              {sourceName}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild className="min-w-0">
              <Link href={`/source/${sourceId}`} className="truncate max-w-40">
                {sourceName}
              </Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {/* Mobile: collapse everything between the source and the current folder. */}
        {hasHiddenCrumbs ? (
          <>
            <BreadcrumbSeparator className="sm:hidden" />
            <BreadcrumbItem className="sm:hidden">
              <BreadcrumbEllipsis className="size-4" />
            </BreadcrumbItem>
          </>
        ) : null}

        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const hiddenOnMobile = !isLast ? "max-sm:hidden" : undefined;
          return (
            <Fragment key={crumb.prefix}>
              <BreadcrumbSeparator className={hiddenOnMobile} />
              <BreadcrumbItem
                className={`min-w-0 font-mono text-xs ${hiddenOnMobile ?? ""}`}
              >
                {isLast ? (
                  <BreadcrumbPage className="truncate font-mono text-xs">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="min-w-0">
                    <Link
                      href={{
                        pathname: `/source/${sourceId}`,
                        query: { prefix: crumb.prefix },
                      }}
                      className="truncate max-w-32"
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
