import { Cylinder } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SourceAccess } from "@/features/admin/components/source-access";
import { AddSourceButton } from "@/features/sources/components/add-source-button";
import { ProviderPlate } from "@/features/sources/components/provider-logos";
import { SourceCardActions } from "@/features/sources/components/source-card-actions";
import { getSourceHealth } from "@/features/sources/server/health";
import { requireAdmin } from "@/lib/auth/session";
import { listGroupOptions } from "@/lib/dal/groups";
import { listGrantsForSource } from "@/lib/dal/permissions";
import { getSource, listSources } from "@/lib/dal/sources";
import { listUserOptions } from "@/lib/dal/users";
import { localFsRoots } from "@/lib/storage/local-roots";
import { getProvider } from "@/lib/storage/providers";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sources");
  return { title: t("metaTitle") };
}

export default async function AdminSourcesPage() {
  await requireAdmin();
  const t = await getTranslations("sources");
  const [sources, users, groups] = await Promise.all([
    listSources(),
    listUserOptions(),
    listGroupOptions(),
  ]);
  const [grantsBySource, details, health] = await Promise.all([
    Promise.all(sources.map((source) => listGrantsForSource(source.id))),
    Promise.all(sources.map((source) => getSource(source.id))),
    Promise.all(sources.map((source) => getSourceHealth(source.id))),
  ]);
  const fsRoots = localFsRoots();

  return (
    <>
      <PageHeader title={t("title")} description={t("description")}>
        <AddSourceButton localFsRoots={fsRoots} />
      </PageHeader>

      {sources.length === 0 ? (
        <EmptyState
          icon={Cylinder}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="space-y-4">
          {sources.map((source, index) => {
            const detail = details[index];
            const sourceHealth = health[index];
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
                  <div className="flex flex-col items-end gap-0.5 text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          sourceHealth.status === "ok"
                            ? "bg-emerald-500"
                            : "bg-red-500",
                        )}
                        aria-hidden
                      />
                      {sourceHealth.status === "ok"
                        ? t("health.reachable")
                        : t("health.unreachable")}
                    </span>
                    {sourceHealth.status === "ok" ? (
                      <span className="text-muted-foreground">
                        {t("health.latency", { ms: sourceHealth.latencyMs })}
                      </span>
                    ) : sourceHealth.error ? (
                      <span
                        className="max-w-64 truncate text-muted-foreground"
                        title={sourceHealth.error}
                      >
                        {sourceHealth.error}
                      </span>
                    ) : null}
                  </div>
                  <SourceCardActions
                    source={source}
                    localFsRoots={fsRoots}
                    editValues={{
                      name: source.name,
                      provider: source.provider,
                      bucket: source.bucket,
                      endpoint: detail?.endpoint ?? "",
                      accessKeyId: detail?.accessKeyId ?? "",
                      // The secret never reaches the client — blank keeps it.
                      secretAccessKey: "",
                      allowPublicShares: detail?.allowPublicShares ?? true,
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
