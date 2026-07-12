import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <Skeleton className="h-4 w-40" />
      </header>
      <main className="flex-1 px-4 py-2">
        <div className="space-y-1 pt-10">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex h-12 items-center gap-3 px-2">
              <Skeleton className="size-4 shrink-0 rounded" />
              <Skeleton className="h-4 w-1/3" />
              <div className="flex-1" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
