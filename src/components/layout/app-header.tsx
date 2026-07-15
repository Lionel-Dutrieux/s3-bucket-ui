import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * The sticky top bar every page shares: sidebar trigger + nav-level title,
 * with room for page-level controls on the right. One component instead of
 * a copy of the same header in every page.
 */
export function AppHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <h1 className="text-sm font-medium">{title}</h1>
      {children ? (
        <div className="ml-auto flex items-center gap-2">{children}</div>
      ) : null}
    </header>
  );
}

/** Centered content column under the AppHeader — the admin-page rhythm. */
export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 bg-muted/20">
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-6">
        {children}
      </div>
    </main>
  );
}
