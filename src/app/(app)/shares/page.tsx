import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-sm font-medium">Shared links</h1>
      </header>

      <main className="flex-1 bg-muted/20">
        <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-6">
          <PageHeader
            title="Shared links"
            description={
              isAdminViewer
                ? "Public links on this instance. Revoking one kills it immediately for everyone."
                : "Public links you created. Revoking one kills it immediately for everyone."
            }
          />
          <SharesTable shares={rows} />
        </div>
      </main>
    </>
  );
}
