import type { Metadata } from "next";
import { headers } from "next/headers";
import { PageHeader } from "@/components/page-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { ProfileForm } from "@/features/auth/components/profile-form";
import {
  type SessionRow,
  SessionsList,
} from "@/features/auth/components/sessions-list";
import { auth } from "@/lib/auth/auth";
import { requireSession } from "@/lib/auth/session";
import { isOidcOnly } from "@/lib/dal/settings";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await requireSession();
  const requestHeaders = await headers();
  const [sessions, accounts, oidcOnly] = await Promise.all([
    auth.api.listSessions({ headers: requestHeaders }),
    auth.api.listUserAccounts({ headers: requestHeaders }),
    isOidcOnly(),
  ]);

  // OIDC-provisioned accounts have no password to change; OIDC-only mode
  // blocks the endpoint anyway.
  const hasPassword = accounts.some(
    (account) => account.providerId === "credential",
  );
  const sessionRows: SessionRow[] = sessions
    .map((row) => ({
      token: row.token,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ipAddress: row.ipAddress ?? null,
      userAgent: row.userAgent ?? null,
      current: row.token === session.session.token,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-sm font-medium">Account</h1>
      </header>

      <main className="flex-1 bg-muted/20">
        <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-6">
          {/* "Your account", not "Account": the sticky header above already
              carries the nav label — stacking the same word twice reads odd.
              Sections are h3, one level under this h2. */}
          <PageHeader
            title="Your account"
            description={`Signed in as ${session.user.email}.`}
          />

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold">Profile</h3>
            <ProfileForm name={session.user.name} />
          </section>

          {hasPassword && !oidcOnly ? (
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">Password</h3>
              <ChangePasswordForm />
            </section>
          ) : null}

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold">Sessions</h3>
            <p className="mt-0.5 mb-1 text-xs text-muted-foreground">
              Everywhere this account is signed in. Revoking a session signs
              that device out immediately.
            </p>
            <SessionsList sessions={sessionRows} />
          </section>
        </div>
      </main>
    </>
  );
}
