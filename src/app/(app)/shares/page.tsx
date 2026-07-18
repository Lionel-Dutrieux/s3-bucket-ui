import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppHeader, PageContainer } from "@/components/layout/app-header";
import { PageHeader } from "@/components/page-header";
import {
  type DropLinkRow,
  DropLinksTable,
} from "@/features/drops/components/drop-links-table";
import {
  type ShareRow,
  SharesTable,
} from "@/features/shares/components/shares-table";
import { requireSession } from "@/lib/auth/session";
import { listDropLinksFor } from "@/lib/dal/drops";
import { listSharesFor } from "@/lib/dal/shares";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shares");
  return { title: t("metaTitle") };
}

export default async function SharesPage() {
  const session = await requireSession();
  const t = await getTranslations("shares");
  const dt = await getTranslations("drops.management");
  const [shares, drops] = await Promise.all([
    listSharesFor(session.user),
    listDropLinksFor(session.user),
  ]);
  const rows: ShareRow[] = shares.map((share) => ({
    id: share.id,
    key: share.key,
    kind: share.kind,
    sourceName: share.source?.name ?? t("deletedSource"),
    createdAt: share.createdAt.getTime(),
    expiresAt: share.expiresAt?.getTime() ?? null,
    revoked: share.revokedAt !== null,
    downloads: share.downloads,
    maxDownloads: share.maxDownloads,
    hasPassword: share.passwordHash !== null,
  }));
  const dropRows: DropLinkRow[] = drops.map((drop) => ({
    id: drop.id,
    prefix: drop.prefix,
    sourceName: drop.source?.name ?? t("deletedSource"),
    createdAt: drop.createdAt.getTime(),
    expiresAt: drop.expiresAt?.getTime() ?? null,
    revoked: drop.revokedAt !== null,
    uploadsCount: drop.uploadsCount,
    maxFiles: drop.maxFiles,
    maxSizeMb: drop.maxSizeMb,
    hasPassword: drop.passwordHash !== null,
  }));
  const isAdminViewer = session.user.role === "admin";

  return (
    <>
      <AppHeader title={t("headerTitle")} />

      <PageContainer>
        <PageHeader
          title={t("title")}
          description={
            isAdminViewer ? t("descriptionAdmin") : t("descriptionUser")
          }
        />
        <SharesTable shares={rows} />

        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{dt("sectionTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {isAdminViewer
                ? dt("sectionDescriptionAdmin")
                : dt("sectionDescriptionUser")}
            </p>
          </div>
          <DropLinksTable drops={dropRows} />
        </div>
      </PageContainer>
    </>
  );
}
