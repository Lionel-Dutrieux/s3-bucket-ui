/**
 * Tiny in-memory TTL cache — pure logic (no I/O, no React), unit-tested.
 *
 * Backs the source health probe: a fresh entry is served straight from memory
 * so a sidebar full of clients polling every 60 s never hammers the backends.
 * Time is injected (`now`) so the TTL behaviour is deterministic under test.
 */
export interface TtlCacheEntry<V> {
  value: V;
  storedAt: number;
}

export class TtlCache<V> {
  private readonly store = new Map<string, TtlCacheEntry<V>>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns the cached value while it is younger than the TTL; evicts and
   *  returns undefined once it has expired (or was never set). */
  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.now() - entry.storedAt >= this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    this.store.set(key, { value, storedAt: this.now() });
  }
}
