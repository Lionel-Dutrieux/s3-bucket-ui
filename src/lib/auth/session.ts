import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;
export type SessionUser = Session["user"];

/**
 * One session lookup per request (React cache). Every server entry point
 * (page, server action, route handler) re-checks through this — a check in a
 * layout protects nothing else.
 */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export function isAdmin(user: Pick<SessionUser, "role">): boolean {
  return user.role === "admin";
}

/** Pages: redirects anonymous visitors to the sign-in page. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** Admin pages: 404 for non-admins — don't advertise what exists. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!isAdmin(session.user)) notFound();
  return session;
}

/** Actions and route handlers: no redirect, the caller shapes the failure. */
export async function currentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}
