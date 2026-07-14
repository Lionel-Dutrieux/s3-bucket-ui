import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/components/page-header";
import { SourceAccess } from "@/features/admin/components/source-access";
import { AddSourceDialog } from "@/features/sources/components/add-source-dialog";
import { providerIcon } from "@/features/sources/components/provider-icons";
import { requireAdmin } from "@/lib/auth/session";
import { listGroupOptions } from "@/lib/dal/groups";
import { listGrantsForSource } from "@/lib/dal/permissions";
import { listSources } from "@/lib/dal/sources";
import { listUserOptions } from "@/lib/dal/users";
import { getProvider } from "@/lib/storage/providers";

export const metadata: Metadata = { title: "Sources" };

export default async function AdminSourcesPage() {
  await requireAdmin();
  const [sources, users, groups] = await Promise.all([
    listSources(),
    listUserOptions(),
    listGroupOptions(),
  ]);
  const grantsBySource = await Promise.all(
    sources.map((source) => listGrantsForSource(source.id)),
  );

  return (
    <>
      <PageHeader
        title="Sources"
        description="Connect buckets and decide who can use them. A grant row gives read access; the switches add edit (upload, rename, move, new folder) and delete."
      >
        <AddSourceDialog>
          <Button size="sm">
            <Plus aria-hidden />
            Add source
          </Button>
        </AddSourceDialog>
      </PageHeader>

      {sources.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm font-medium">No sources yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add a bucket to start granting access — it stays invisible to
            everyone but admins until you do.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map((source, index) => {
            const Icon = providerIcon(source.provider);
            return (
              <section
                key={source.id}
                className="rounded-xl border bg-card shadow-sm"
              >
                <header className="flex items-center gap-3 border-b px-4 py-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
                    <Icon className="size-4.5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">
                      {source.name}
                    </h3>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {getProvider(source.provider)?.label ?? source.provider} ·{" "}
                      {source.bucket}
                    </p>
                  </div>
                </header>
                <div className="p-4">
                  <SourceAccess
                    sourceId={source.id}
                    grants={grantsBySource[index]}
                    users={users}
                    groups={groups}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
