import Link from "next/link";
import { ChevronRight, Cylinder, Plus } from "lucide-react";
import { AddSourceDialog } from "@/features/sources/components/add-source-dialog";
import { providerIcon } from "@/features/sources/components/provider-icons";
import { getProvider } from "@/features/sources/lib/providers";
import { listSources } from "@/lib/dal/sources";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default async function HomePage() {
  const sources = await listSources();

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <span className="text-sm font-medium">All sources</span>
        {sources.length > 0 ? (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {sources.length} source{sources.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </header>

      {sources.length === 0 ? (
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
              <Cylinder className="size-6" aria-hidden />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">
              No sources yet
            </h1>
            <p className="text-sm text-muted-foreground">
              Connect a storage bucket to start browsing your files.
            </p>
            <AddSourceDialog>
              <Button className="mt-2">
                <Plus aria-hidden />
                Add source
              </Button>
            </AddSourceDialog>
          </div>
        </main>
      ) : (
        <main className="flex-1 p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => {
              const ProviderIcon = providerIcon(source.provider);
              return (
                <Link
                  key={source.id}
                  href={`/source/${source.id}`}
                  className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
                    <ProviderIcon className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {source.name}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {getProvider(source.provider)?.label ?? source.provider} ·{" "}
                      {source.bucket}
                    </p>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </Link>
              );
            })}
          </div>
        </main>
      )}
    </>
  );
}
