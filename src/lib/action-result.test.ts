import { describe, expect, it } from "vitest";
import { actionError, actionOk } from "@/lib/action-result";

describe("actionOk", () => {
  it("returns a success result with undefined data when called bare", () => {
    expect(actionOk()).toEqual({ ok: true, data: undefined });
  });

  it("carries the payload through", () => {
    expect(actionOk({ id: "abc" })).toEqual({
      ok: true,
      data: { id: "abc" },
    });
  });

  it("preserves falsy payloads", () => {
    expect(actionOk(0)).toEqual({ ok: true, data: 0 });
    expect(actionOk("")).toEqual({ ok: true, data: "" });
    expect(actionOk(null)).toEqual({ ok: true, data: null });
  });
});

describe("actionError", () => {
  it("returns a failure result carrying the message", () => {
    expect(actionError("Nope.")).toEqual({ ok: false, error: "Nope." });
  });

  it("never exposes a data field", () => {
    expect(actionError("boom")).not.toHaveProperty("data");
  });
});

describe("ActionResult union", () => {
  it("narrows on ok", () => {
    const ok = actionOk(42);
    const err = actionError("bad");
    expect(ok.ok ? ok.data : null).toBe(42);
    expect(err.ok ? null : err.error).toBe("bad");
  });
});
