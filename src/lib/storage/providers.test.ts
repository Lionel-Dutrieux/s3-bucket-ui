import { describe, expect, it } from "vitest";
import {
  getProvider,
  normalizeEndpoint,
  PROVIDERS,
} from "@/lib/storage/providers";

describe("normalizeEndpoint", () => {
  it("normalizes object-store endpoints to the https origin", () => {
    expect(
      normalizeEndpoint("aws-s3", "https://s3.eu-west-3.amazonaws.com/extra/"),
    ).toEqual({
      ok: true,
      value: "https://s3.eu-west-3.amazonaws.com",
    });
  });

  it("rejects non-https endpoints for object stores", () => {
    expect(normalizeEndpoint("r2", "http://example.com").ok).toBe(false);
    expect(normalizeEndpoint("minio", "not a url").ok).toBe(false);
  });

  it("keeps the WebDAV path and strips trailing slashes", () => {
    expect(
      normalizeEndpoint(
        "webdav",
        "https://cloud.example.com/remote.php/dav/files/alice/",
      ),
    ).toEqual({
      ok: true,
      value: "https://cloud.example.com/remote.php/dav/files/alice",
    });
  });

  it("accepts plain http for WebDAV (LAN NAS), nothing else", () => {
    expect(normalizeEndpoint("webdav", "http://nas.local/dav").ok).toBe(true);
    expect(normalizeEndpoint("webdav", "ftp://nas.local/dav").ok).toBe(false);
  });

  it("reduces sftp endpoints to scheme + host and keeps the port", () => {
    expect(normalizeEndpoint("sftp", "sftp://files.example.com:2222")).toEqual({
      ok: true,
      value: "sftp://files.example.com:2222",
    });
    expect(
      normalizeEndpoint("sftp", "sftp://files.example.com/ignored"),
    ).toEqual({ ok: true, value: "sftp://files.example.com" });
    expect(normalizeEndpoint("sftp", "https://files.example.com").ok).toBe(
      false,
    );
  });

  it("accepts ftp and ftps schemes for FTP", () => {
    expect(normalizeEndpoint("ftp", "ftps://ftp.example.com:990")).toEqual({
      ok: true,
      value: "ftps://ftp.example.com:990",
    });
    expect(normalizeEndpoint("ftp", "ftp://ftp.example.com")).toEqual({
      ok: true,
      value: "ftp://ftp.example.com",
    });
    expect(normalizeEndpoint("ftp", "sftp://ftp.example.com").ok).toBe(false);
  });
});

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
