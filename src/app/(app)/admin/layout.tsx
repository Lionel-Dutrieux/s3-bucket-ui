import { SidebarTrigger } from "@/components/ui/sidebar";
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

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-sm font-medium">Administration</h1>
      </header>
      <AdminNav />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl space-y-6 p-4 py-6 md:px-6">
          {children}
        </div>
      </main>
    </>
  );
}
