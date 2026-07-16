import { Cylinder } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SourceAccess } from "@/features/admin/components/source-access";
import { AddSourceButton } from "@/features/sources/components/add-source-button";
import { ProviderPlate } from "@/features/sources/components/provider-logos";
import { SourceCardActions } from "@/features/sources/components/source-card-actions";
import { requireAdmin } from "@/lib/auth/session";
import { listGroupOptions } from "@/lib/dal/groups";
import { listGrantsForSource } from "@/lib/dal/permissions";
import { getSource, listSources } from "@/lib/dal/sources";
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
  const [grantsBySource, details] = await Promise.all([
    Promise.all(sources.map((source) => listGrantsForSource(source.id))),
    Promise.all(sources.map((source) => getSource(source.id))),
  ]);

  return (
    <>
      <PageHeader
        title="Sources"
        description="Connect buckets and decide who can use them. A grant row gives read access; the switches add edit (upload, rename, move, new folder) and delete."
      >
        <AddSourceButton />
      </PageHeader>

      {sources.length === 0 ? (
        <EmptyState
          icon={Cylinder}
          title="No sources yet"
          description="Add a bucket to start granting access — it stays invisible to everyone but admins until you do."
        />
      ) : (
        <div className="space-y-4">
          {sources.map((source, index) => {
            const detail = details[index];
            return (
              <section
                key={source.id}
                className="rounded-xl border bg-card shadow-sm"
              >
                <header className="flex items-center gap-3 border-b px-4 py-3">
                  <ProviderPlate
                    providerId={source.provider}
                    className="size-9"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold">
                      {source.name}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {getProvider(source.provider)?.label ?? source.provider} ·{" "}
                      {source.bucket}
                    </p>
                  </div>
                  <SourceCardActions
                    source={source}
                    editValues={{
                      name: source.name,
                      provider: source.provider,
                      bucket: source.bucket,
                      endpoint: detail?.endpoint ?? "",
                      accessKeyId: detail?.accessKeyId ?? "",
                      // The secret never reaches the client — blank keeps it.
                      secretAccessKey: "",
                    }}
                    otherSources={sources.filter(
                      (other) => other.id !== source.id,
                    )}
                  />
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
