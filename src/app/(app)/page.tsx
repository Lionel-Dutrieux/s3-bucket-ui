import { ChevronRight, Cylinder, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { providerIcon } from "@/features/sources/components/provider-icons";
import { requireSession } from "@/lib/auth/session";
import { listSourcesFor } from "@/lib/dal/sources";
import { getProvider } from "@/lib/storage/providers";

export default async function HomePage() {
  const session = await requireSession();
  const sources = await listSourcesFor(session.user);

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-sm font-medium">All sources</h1>
      </header>

      <main className="flex-1 bg-muted/20">
        <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-6">
          <PageHeader
            title="Sources"
            description="Every bucket you have access to. Pick one to start browsing."
          >
            {sources.length > 0 ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {sources.length} source{sources.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </PageHeader>

          {sources.length === 0 ? (
            <EmptyState
              icon={Cylinder}
              tone="primary"
              title={
                session.user.role === "admin"
                  ? "No sources yet"
                  : "No sources available"
              }
              description={
                session.user.role === "admin"
                  ? "Connect a storage bucket to start browsing your files."
                  : "An admin needs to grant you access to a source first."
              }
            >
              {session.user.role === "admin" ? (
                <Button size="sm" className="mt-1" asChild>
                  <Link href="/admin/sources">
                    <Plus aria-hidden />
                    Add source
                  </Link>
                </Button>
              ) : null}
            </EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sources.map((source) => {
                const ProviderIcon = providerIcon(source.provider);
                return (
                  <Link
                    key={source.id}
                    href={`/source/${source.id}`}
                    className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <ProviderIcon className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {source.name}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {getProvider(source.provider)?.label ?? source.provider}{" "}
                        · {source.bucket}
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
          )}
        </div>
      </main>
    </>
  );
}
