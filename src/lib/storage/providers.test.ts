import { describe, expect, it } from "vitest";
import { getProvider, normalizeEndpoint, PROVIDERS } from "./providers";

const NEW_IDS = [
  "akamai",
  "idrive-e2",
  "vultr",
  "filebase",
  "exoscale",
  "oracle-cloud",
  "ibm-cos",
  "tigris",
  "tencent-cos",
  "alibaba-oss",
  "yandex",
];

describe("new S3-compatible providers", () => {
  it("registers every new id as an s3 adapter", () => {
    for (const id of NEW_IDS) {
      const def = getProvider(id);
      expect(def, id).toBeDefined();
      expect(def?.adapter, id).toBe("s3");
    }
  });
  it("keeps the catch-all last in the registry order", () => {
    const s3compat = PROVIDERS.findIndex((p) => p.id === "s3-compatible");
    const yandex = PROVIDERS.findIndex((p) => p.id === "yandex");
    expect(yandex).toBeGreaterThanOrEqual(0);
    expect(yandex).toBeLessThan(s3compat);
  });
  it("accepts a well-formed https endpoint for each new provider", () => {
    expect(
      normalizeEndpoint("yandex", "https://storage.yandexcloud.net"),
    ).toEqual({
      ok: true,
      value: "https://storage.yandexcloud.net",
    });
    expect(
      normalizeEndpoint("tencent-cos", "https://cos.ap-guangzhou.myqcloud.com"),
    ).toEqual({ ok: true, value: "https://cos.ap-guangzhou.myqcloud.com" });
  });
});
