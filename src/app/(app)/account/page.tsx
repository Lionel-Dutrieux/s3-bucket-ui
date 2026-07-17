import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AppHeader, PageContainer } from "@/components/layout/app-header";
import { PageHeader } from "@/components/page-header";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { ProfileForm } from "@/features/auth/components/profile-form";
import {
  type SessionRow,
  SessionsList,
} from "@/features/auth/components/sessions-list";
import { getAuth } from "@/lib/auth/auth";
import { requireSession } from "@/lib/auth/session";
import { isOidcOnly } from "@/lib/dal/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("metaTitle") };
}

export default async function AccountPage() {
  const session = await requireSession();
  const t = await getTranslations("account");
  const requestHeaders = await headers();
  const auth = await getAuth();
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
      <AppHeader title={t("headerTitle")} />

      <PageContainer>
        {/* "Your account", not "Account": the sticky header above already
              carries the nav label — stacking the same word twice reads odd.
              Sections are h3, one level under this h2. */}
        <PageHeader
          title={t("title")}
          description={t("description", { email: session.user.email })}
        />

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold">{t("profileSection")}</h3>
          <ProfileForm name={session.user.name} />
        </section>

        {hasPassword && !oidcOnly ? (
          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold">
              {t("passwordSection")}
            </h3>
            <ChangePasswordForm />
          </section>
        ) : null}

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">{t("sessionsSection")}</h3>
          <p className="mt-0.5 mb-1 text-xs text-muted-foreground">
            {t("sessionsDescription")}
          </p>
          <SessionsList sessions={sessionRows} />
        </section>
      </PageContainer>
    </>
  );
}
