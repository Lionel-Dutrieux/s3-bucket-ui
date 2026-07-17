import { requireSession } from "@/lib/auth/session";

/**
 * Minimal shell for policy gates — no sidebar. Requires a session (redirects
 * anonymous visitors to /sign-in) but does NOT enforce the 2FA policy itself:
 * that lives in (app)/layout.tsx. Keeping this layout enforcement-free is
 * what lets /setup-2fa exist outside the gate it satisfies, avoiding a
 * redirect loop.
 */
export default async function GateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireSession();

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
