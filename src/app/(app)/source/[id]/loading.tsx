import { cookies } from "next/headers";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { VIEW_COOKIE } from "@/features/browser/lib/view";

// Reads the same view cookie as the page so the skeleton matches what will
// render — a grid of cards while loading a grid, rows while loading a list.
export default async function Loading() {
  const view =
    (await cookies()).get(VIEW_COOKIE)?.value === "grid" ? "grid" : "list";

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <Skeleton className="h-4 w-40" />
      </header>
      <main className="flex-1 p-4 pt-3">
        <div className="mb-4 flex items-center gap-3">
          <Skeleton className="h-8 w-full max-w-xs" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        {view === "grid" ? <GridSkeleton /> : <ListSkeleton />}
      </main>
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 8 }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton, never reorders
        <div key={index} className="flex h-12 items-center gap-3 px-2">
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex-1" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="mb-3 h-3 w-14" />
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton, never reorders
              key={index}
              className="flex items-center gap-3 rounded-lg border px-3.5 py-3"
            >
              <Skeleton className="size-9 shrink-0 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="mb-3 h-3 w-10" />
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))]">
          {Array.from({ length: 6 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton, never reorders
            <div key={index} className="overflow-hidden rounded-lg border">
              <Skeleton className="aspect-[4/3] rounded-none" />
              <div className="space-y-1.5 border-t px-3 py-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
