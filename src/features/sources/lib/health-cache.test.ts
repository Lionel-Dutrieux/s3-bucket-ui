import { describe, expect, it } from "vitest";
import { TtlCache } from "./health-cache";

describe("TtlCache", () => {
  it("returns undefined for an unknown key", () => {
    const cache = new TtlCache<string>(1000);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("serves a value while it is fresher than the TTL", () => {
    let now = 0;
    const cache = new TtlCache<string>(1000, () => now);
    cache.set("a", "ok");
    now = 999;
    expect(cache.get("a")).toBe("ok");
  });

  it("evicts a value once the TTL has elapsed", () => {
    let now = 0;
    const cache = new TtlCache<string>(1000, () => now);
    cache.set("a", "ok");
    now = 1000;
    expect(cache.get("a")).toBeUndefined();
    // Still gone on a later read (entry was deleted, not just skipped).
    now = 1001;
    expect(cache.get("a")).toBeUndefined();
  });

  it("refreshes the timestamp on set, extending freshness", () => {
    let now = 0;
    const cache = new TtlCache<number>(1000, () => now);
    cache.set("a", 1);
    now = 900;
    cache.set("a", 2);
    now = 1800; // 900 ms after the second set — still fresh
    expect(cache.get("a")).toBe(2);
  });

  it("keeps entries independent per key", () => {
    let now = 0;
    const cache = new TtlCache<string>(1000, () => now);
    cache.set("a", "a-val");
    now = 500;
    cache.set("b", "b-val");
    now = 1000; // "a" expired, "b" still fresh
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("b-val");
  });
});
