// Pure permission resolution — no I/O, unit-tested. The DAL fetches grants,
// this module decides what they mean.

/** One grant row's capabilities. Holding a grant at all means read access. */
export interface SourceGrant {
  canEdit: boolean;
  canDelete: boolean;
}

/** What the current user may do on a source. Read is implied. */
export interface SourceCapabilities {
  canEdit: boolean;
  canDelete: boolean;
}

/** A user can hold several grants (direct + via groups) — capabilities OR. */
export function mergeGrants(grants: SourceGrant[]): SourceGrant | null {
  if (grants.length === 0) return null;
  return {
    canEdit: grants.some((grant) => grant.canEdit),
    canDelete: grants.some((grant) => grant.canDelete),
  };
}

/**
 * Role + merged grant → capabilities, or null when the user can't even read
 * the source. Admins implicitly hold every capability on every source.
 */
export function resolveAccess(
  role: string | null | undefined,
  grant: SourceGrant | null,
): SourceCapabilities | null {
  if (role === "admin") return { canEdit: true, canDelete: true };
  if (!grant) return null;
  return { canEdit: grant.canEdit, canDelete: grant.canDelete };
}
