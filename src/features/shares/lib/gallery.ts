// Pure helpers for the public prefix-share gallery. No I/O so Vitest can import
// them directly. Breadcrumbs stay relative to the shared root — a visitor never
// sees (or can navigate to) anything above share.key.

import type { SharePreviewKind } from "@/features/shares/lib/preview";

/** A folder under the shared prefix, for sub-navigation. */
export interface PublicFolder {
  /** FULL prefix (ends with "/") — passed back as ?p=. */
  prefix: string;
  name: string;
}

/** One object under the shared prefix, resolved for the gallery. */
export interface PublicFile {
  key: string;
  name: string;
  size: number;
  /** Inline preview kind, or null for non-media (download only). */
  preview: SharePreviewKind | null;
}

export interface ShareCrumb {
  label: string;
  /** The FULL prefix to hand back as ?p= — always ends with "/". */
  prefix: string;
}

/**
 * Breadcrumbs within a prefix share. The first crumb is the shared folder's
 * own name; deeper crumbs are the sub-path the visitor navigated into. Every
 * prefix returned sits at or under `rootPrefix`, so the trail can never point
 * above the share.
 */
export function shareCrumbs(
  rootPrefix: string,
  currentPrefix: string,
): ShareCrumb[] {
  const rootName = rootPrefix.replace(/\/$/, "").split("/").pop() || rootPrefix;
  const crumbs: ShareCrumb[] = [{ label: rootName, prefix: rootPrefix }];
  if (!currentPrefix.startsWith(rootPrefix)) return crumbs;

  const rest = currentPrefix.slice(rootPrefix.length).replace(/\/$/, "");
  if (!rest) return crumbs;

  let acc = rootPrefix;
  for (const segment of rest.split("/").filter(Boolean)) {
    acc = `${acc}${segment}/`;
    crumbs.push({ label: segment, prefix: acc });
  }
  return crumbs;
}
