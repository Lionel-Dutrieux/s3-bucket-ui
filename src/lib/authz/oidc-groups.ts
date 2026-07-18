// Pure normalization of the IdP `groups` claim — no I/O, unit-tested.

/**
 * Normalizes whatever the IdP put in the groups claim into a clean string
 * array: arrays keep their string entries, a single string is split on
 * commas/whitespace, anything else yields []. Deduplicated, empties dropped.
 */
export function normalizeGroupsClaim(value: unknown): string[] {
  let names: string[] = [];
  if (Array.isArray(value)) {
    names = value.filter((entry): entry is string => typeof entry === "string");
  } else if (typeof value === "string") {
    names = value.split(/[\s,]+/);
  }
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

/**
 * Decodes the payload of a JWT without verifying its signature — used only to
 * read the `groups` claim from an id_token we already trust (it came straight
 * from the token endpoint over TLS). Returns null for anything that isn't a
 * well-formed three-segment JWT with a JSON object payload.
 */
export function decodeJwtPayload(jwt: unknown): Record<string, unknown> | null {
  if (typeof jwt !== "string") return null;
  const segments = jwt.split(".");
  if (segments.length !== 3) return null;
  const payload = segments[1];
  if (!payload) return null;
  try {
    // base64url → base64, then decode. Buffer handles missing padding.
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the IdP group names for a sign-in from the two places a provider may
 * expose them: the userinfo/profile object first, then — when the claim is only
 * present in the id_token (Microsoft Entra puts groups there, not in userinfo)
 * — the decoded id_token payload. Returns a clean, deduplicated name list.
 */
export function extractGroups(
  userInfo: Record<string, unknown> | null | undefined,
  idToken: unknown,
  claimName: string,
): string[] {
  const fromUserInfo = normalizeGroupsClaim(userInfo?.[claimName]);
  if (fromUserInfo.length > 0) return fromUserInfo;
  return normalizeGroupsClaim(decodeJwtPayload(idToken)?.[claimName]);
}
