import { describe, expect, it } from "vitest";
import { apiError } from "@/lib/api-error";

describe("apiError", () => {
  it("sets the given status", () => {
    expect(apiError(404, "Not found").status).toBe(404);
  });

  it("serialises the message as { error } JSON", async () => {
    const res = apiError(500, "Boom");
    await expect(res.json()).resolves.toEqual({ error: "Boom" });
  });

  it("sends a JSON content type", () => {
    const res = apiError(400, "Bad");
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("preserves the message verbatim", async () => {
    const res = apiError(403, "Access denied — insufficient grants.");
    await expect(res.json()).resolves.toEqual({
      error: "Access denied — insufficient grants.",
    });
  });
});
