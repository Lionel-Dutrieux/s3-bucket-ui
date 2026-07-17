import { getTranslations } from "next-intl/server";
import { AppHeader, PageContainer } from "@/components/layout/app-header";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // UX guard for the whole /admin section — every admin action re-checks the
  // role itself (a layout protects pages, not POST endpoints).
  await requireAdmin();
  const t = await getTranslations("admin.layout");

  return (
    <>
      <AppHeader title={t("headerTitle")} />
      <div className="border-b bg-background">
        <div className="mx-auto w-full max-w-5xl px-4 md:px-6">
          <AdminNav />
        </div>
      </div>
      <PageContainer>{children}</PageContainer>
    </>
  );
}
