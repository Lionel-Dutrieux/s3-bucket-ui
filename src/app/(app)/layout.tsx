import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireSession } from "@/lib/auth/session";
import { listSourcesFor } from "@/lib/dal/sources";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // UX guard only — every page, action and route handler re-checks the
  // session itself (a layout protects none of them).
  const session = await requireSession();
  const sources = await listSourcesFor(session.user);

  return (
    <SidebarProvider>
      <AppSidebar
        sources={sources}
        user={{
          name: session.user.name,
          email: session.user.email,
          role: session.user.role ?? "user",
        }}
      />
      <SidebarInset>{children}</SidebarInset>
      <CommandPalette
        sources={sources}
        canManage={session.user.role === "admin"}
      />
    </SidebarProvider>
  );
}
