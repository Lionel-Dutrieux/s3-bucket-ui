import type { Metadata } from "next";
import { AppHeader, PageContainer } from "@/components/layout/app-header";
import { PageHeader } from "@/components/page-header";
import {
  type ShareRow,
  SharesTable,
} from "@/features/shares/components/shares-table";
import { requireSession } from "@/lib/auth/session";
import { listSharesFor } from "@/lib/dal/shares";

export const metadata: Metadata = { title: "Shared links" };

export default async function SharesPage() {
  const session = await requireSession();
  const shares = await listSharesFor(session.user);
  const rows: ShareRow[] = shares.map((share) => ({
    id: share.id,
    key: share.key,
    sourceName: share.source?.name ?? "(deleted source)",
    createdAt: share.createdAt.getTime(),
    expiresAt: share.expiresAt?.getTime() ?? null,
    revoked: share.revokedAt !== null,
    downloads: share.downloads,
    hasPassword: share.passwordHash !== null,
  }));
  const isAdminViewer = session.user.role === "admin";

  return (
    <>
      <AppHeader title="Shared links" />

      <PageContainer>
        <PageHeader
          title="Shared links"
          description={
            isAdminViewer
              ? "Public links on this instance. Revoking one kills it immediately for everyone."
              : "Public links you created. Revoking one kills it immediately for everyone."
          }
        />
        <SharesTable shares={rows} />
      </PageContainer>
    </>
  );
}
