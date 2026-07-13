// Pure move planning — no I/O, unit-tested in move.test.ts.

export type EntryTarget =
  | { kind: "file"; key: string }
  | { kind: "folder"; prefix: string };

export interface MoveOp {
  kind: "file" | "folder";
  /** Source key (file) or prefix (folder). */
  from: string;
  /** Destination key (file) or prefix (folder). */
  to: string;
}

export interface MovePlan {
  moves: MoveOp[];
  error?: string;
}

/** "a/b/c.txt" → "c.txt" */
export function basename(key: string): string {
  return key.slice(key.lastIndexOf("/") + 1);
}

/** "a/b/" → "b" */
export function folderName(prefix: string): string {
  const withoutTrailing = prefix.slice(0, -1);
  return withoutTrailing.slice(withoutTrailing.lastIndexOf("/") + 1);
}

/** The folder a target currently lives in ("" = root). */
export function parentOf(target: EntryTarget): string {
  const path = target.kind === "file" ? target.key : target.prefix.slice(0, -1);
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash + 1);
}

/** Where a target lands under `destPrefix` ("" = root). */
export function destinationFor(
  target: EntryTarget,
  destPrefix: string,
): string {
  return target.kind === "file"
    ? destPrefix + basename(target.key)
    : `${destPrefix + folderName(target.prefix)}/`;
}

/** True when the target already sits directly in `destPrefix`. */
export function isNoop(target: EntryTarget, destPrefix: string): boolean {
  return parentOf(target) === destPrefix;
}

/** A folder can't move into itself or any path beneath it. */
export function isIntoSelfOrDescendant(
  folderPrefix: string,
  destPrefix: string,
): boolean {
  return destPrefix.startsWith(folderPrefix);
}

/**
 * Turns a selection + destination into concrete move ops. Drops no-ops
 * (already in the destination); returns an error if a folder would move into
 * itself or a descendant. I/O-free — the conflict check that needs the bucket
 * lives in the server action.
 */
export function planMove(targets: EntryTarget[], destPrefix: string): MovePlan {
  const moves: MoveOp[] = [];
  for (const target of targets) {
    if (isNoop(target, destPrefix)) continue;
    if (
      target.kind === "folder" &&
      isIntoSelfOrDescendant(target.prefix, destPrefix)
    ) {
      return { moves: [], error: "You can't move a folder into itself." };
    }
    moves.push({
      kind: target.kind,
      from: target.kind === "file" ? target.key : target.prefix,
      to: destinationFor(target, destPrefix),
    });
  }
  return { moves };
}
