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
