import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getSourceHealth } from "@/features/sources/server/health";
import { apiError } from "@/lib/api-error";
import { getSession } from "@/lib/auth/session";
import { listSourcesFor } from "@/lib/dal/sources";

/**
 * Health of every source the signed-in user can read (same grant filter as the
 * sidebar). Non-admins get only the status; admins also get latency and the
 * raw error detail (endpoint-revealing, so never sent to a regular user).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    const t = await getTranslations("api.errors");
    return apiError(401, t("signInRequired"));
  }

  const admin = session.user.role === "admin";
  const sources = await listSourcesFor(session.user);
  const entries = await Promise.all(
    sources.map(async (source) => {
      const health = await getSourceHealth(source.id);
      const value = admin
        ? health
        : ({ status: health.status } as { status: typeof health.status });
      return [source.id, value] as const;
    }),
  );

  return NextResponse.json({ health: Object.fromEntries(entries) });
}
