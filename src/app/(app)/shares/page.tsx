import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppHeader, PageContainer } from "@/components/layout/app-header";
import { PageHeader } from "@/components/page-header";
import {
  type ShareRow,
  SharesTable,
} from "@/features/shares/components/shares-table";
import { requireSession } from "@/lib/auth/session";
import { listSharesFor } from "@/lib/dal/shares";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shares");
  return { title: t("metaTitle") };
}

export default async function SharesPage() {
  const session = await requireSession();
  const t = await getTranslations("shares");
  const shares = await listSharesFor(session.user);
  const rows: ShareRow[] = shares.map((share) => ({
    id: share.id,
    key: share.key,
    sourceName: share.source?.name ?? t("deletedSource"),
    createdAt: share.createdAt.getTime(),
    expiresAt: share.expiresAt?.getTime() ?? null,
    revoked: share.revokedAt !== null,
    downloads: share.downloads,
    maxDownloads: share.maxDownloads,
    hasPassword: share.passwordHash !== null,
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
      </PageContainer>
    </>
  );
}
