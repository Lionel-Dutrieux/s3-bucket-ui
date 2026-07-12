import { Fragment } from "react";
import Link from "next/link";
import { buildCrumbs } from "@/features/browser/listing";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap overflow-x-auto">
        <BreadcrumbItem>
          {crumbs.length === 0 ? (
            <BreadcrumbPage className="text-sm font-medium">
              {sourceName}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href={`/source/${sourceId}`}>{sourceName}</Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.prefix}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="font-mono text-xs">
                {isLast ? (
                  <BreadcrumbPage className="font-mono text-xs">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      href={{
                        pathname: `/source/${sourceId}`,
                        query: { prefix: crumb.prefix },
                      }}
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
