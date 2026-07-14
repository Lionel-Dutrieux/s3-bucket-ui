import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Admins see every source. Everyone else needs a grant: a row below
          gives read access, the switches add edit (upload, rename, new folder)
          and delete. Renaming and moving need both.
        </p>
        <AddSourceDialog>
          <Button size="sm" className="shrink-0">
            <Plus aria-hidden />
            Add source
          </Button>
        </AddSourceDialog>
      </div>

      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sources yet — add one to start granting access.
        </p>
      ) : (
        <div className="space-y-4">
          {sources.map((source, index) => {
            const Icon = providerIcon(source.provider);
            return (
              <section
                key={source.id}
                className="rounded-xl border bg-card p-4 shadow-sm"
              >
                <header className="mb-3 flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
                    <Icon className="size-4.5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">
                      {source.name}
                    </h2>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {getProvider(source.provider)?.label ?? source.provider} ·{" "}
                      {source.bucket}
                    </p>
                  </div>
                </header>
                <SourceAccess
                  sourceId={source.id}
                  grants={grantsBySource[index]}
                  users={users}
                  groups={groups}
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
