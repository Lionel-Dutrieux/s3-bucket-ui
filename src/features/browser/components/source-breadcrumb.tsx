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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildCrumbs, type Crumb } from "@/features/browser/lib/listing";

// The Drive pattern: the path IS the title — no back arrow. Every parent
// segment is a link; deep paths collapse their middle into a "…" menu.
// Desktop keeps the last two segments visible, mobile only the current one.
const VISIBLE_TAIL = 2;

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

  const folderHref = (crumb: Crumb) => ({
    pathname: `/source/${sourceId}`,
    query: { prefix: crumb.prefix },
  });

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap text-base">
        <BreadcrumbItem className="min-w-0">
          {crumbs.length === 0 ? (
            <BreadcrumbPage className="truncate font-semibold">
              {sourceName}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild className="min-w-0">
              <Link
                href={`/source/${sourceId}`}
                className="max-w-40 truncate max-sm:hidden"
              >
                {sourceName}
              </Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {collapsed.length > 0 ? (
          <>
            <BreadcrumbSeparator className="max-sm:hidden" />
            <BreadcrumbItem className="max-sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center rounded-md px-0.5 hover:text-foreground"
                  aria-label="Show hidden folders"
                >
                  <BreadcrumbEllipsis className="size-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {collapsed.map((crumb) => (
                    <DropdownMenuItem key={crumb.prefix} asChild>
                      <Link href={folderHref(crumb)}>{crumb.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
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
                      href={folderHref(crumb)}
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
