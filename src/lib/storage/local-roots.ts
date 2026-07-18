import "server-only";
import { realpath } from "node:fs/promises";
import path from "node:path";

// Operator-controlled allowlist for "Local folder" sources. Read straight
// from process.env (not lib/env) so tests can vary it per-case — same
// pattern as lib/crypto.ts. env.ts still declares it for boot validation.

/** Absolute, resolved allowlist roots. Empty array = feature disabled. */
export function localFsRoots(): string[] {
  return (process.env.LOCAL_FS_ROOTS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
}

export type LocalRootCheck =
  | { ok: true; value: string }
  | { ok: false; reason: "disabled" | "outside" | "unreachable" };

/**
 * Validates a "Local folder" root path against LOCAL_FS_ROOTS. Resolves
 * symlinks on both sides (realpath) so `../` tricks and links pointing out
 * of an allowed root are caught; on success returns the canonical path to
 * store, so every later adapter call starts from a vetted directory.
 */
export async function checkLocalRoot(
  rootPath: string,
): Promise<LocalRootCheck> {
  const allowed = localFsRoots();
  if (allowed.length === 0) return { ok: false, reason: "disabled" };

  let resolved: string;
  try {
    resolved = await realpath(path.resolve(rootPath));
  } catch {
    return { ok: false, reason: "unreachable" };
  }

  for (const root of allowed) {
    let realRoot: string;
    try {
      realRoot = await realpath(root);
    } catch {
      continue; // configured root missing on disk — never matches
    }
    if (resolved === realRoot || resolved.startsWith(realRoot + path.sep)) {
      return { ok: true, value: resolved };
    }
  }
  return { ok: false, reason: "outside" };
}
