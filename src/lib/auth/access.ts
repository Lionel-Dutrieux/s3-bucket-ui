import "server-only";
import { cache } from "react";
import type { SourceCapabilities } from "@/lib/authz/permissions";
import { resolveAccess } from "@/lib/authz/permissions";
import { getGrantFor } from "@/lib/dal/permissions";
import { getSource, type Source } from "@/lib/dal/sources";
import { getSession, isAdmin } from "./session";

export interface SourceAccessResult {
  source: Source;
  access: SourceCapabilities;
}

/**
 * The single read gate for a source: session + source + grant, resolved to
 * capabilities. Returns null for "no session", "no such source" and "no read
 * grant" alike — callers answer with a uniform 404/notFound() so the
 * existence of a source is never revealed to someone who can't read it.
 */
export const requireSourceAccess = cache(
  async (sourceId: string): Promise<SourceAccessResult | null> => {
    const session = await getSession();
    if (!session) return null;
    const source = await getSource(sourceId);
    if (!source) return null;
    const grant = isAdmin(session.user)
      ? null
      : await getGrantFor(session.user.id, sourceId);
    const access = resolveAccess(session.user.role, grant);
    if (!access) return null;
    return { source, access };
  },
);
