import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireSession } from "@/lib/auth/session";
import { twoFactorRequiredFor } from "@/lib/authz/two-factor-policy";
import { getBranding } from "@/lib/branding/branding";
import { getTwoFactorPolicy, isOidcOnly } from "@/lib/dal/settings";
import { listSourcesFor } from "@/lib/dal/sources";
import { hasPasswordCredential } from "@/lib/dal/users";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // UX guard only — every page, action and route handler re-checks the
  // session itself (a layout protects none of them).
  const session = await requireSession();

  // 2FA enrollment gate: UX/policy only, not a security boundary (nothing
  // downstream trusts it). Order matters — cheapest/most-common-false checks
  // first, so an already-enrolled account runs zero extra queries.
  const policy = await getTwoFactorPolicy();
  if (
    policy !== "off" &&
    !session.user.twoFactorEnabled &&
    twoFactorRequiredFor({ role: session.user.role ?? null }, policy) &&
    !(await isOidcOnly()) &&
    (await hasPasswordCredential(session.user.id))
  ) {
    redirect("/setup-2fa");
  }

  const [sources, branding] = await Promise.all([
    listSourcesFor(session.user),
    getBranding(),
  ]);

  return (
    <SidebarProvider>
      <AppSidebar
        branding={branding}
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
