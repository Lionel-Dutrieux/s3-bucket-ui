import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Files } from "files-sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contentTypeFor, localFs } from "@/lib/storage/fs-adapter";

let root: string;
let files: Files;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "fs-adapter-"));
  files = new Files({ adapter: localFs({ root }) });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("contentTypeFor", () => {
  it("maps common extensions case-insensitively", () => {
    expect(contentTypeFor("photo.JPG")).toBe("image/jpeg");
    expect(contentTypeFor("docs/report.pdf")).toBe("application/pdf");
    expect(contentTypeFor("logo.svg")).toBe("image/svg+xml");
    expect(contentTypeFor("clip.mp4")).toBe("video/mp4");
  });

  it("falls back to octet-stream for unknown or missing extensions", () => {
    expect(contentTypeFor("archive.xyz")).toBe("application/octet-stream");
    expect(contentTypeFor("README")).toBe("application/octet-stream");
  });
});

describe("localFs adapter", () => {
  it("uploads without writing any sidecar file", async () => {
    await files.upload("docs/report.txt", "hello");
    expect(await readdir(path.join(root, "docs"))).toEqual(["report.txt"]);
  });

  it("round-trips content and derives the type from the extension", async () => {
    await files.upload("logo.svg", "<svg/>");
    const stored = await files.download("logo.svg");
    expect(await stored.text()).toBe("<svg/>");
    expect(stored.type).toBe("image/svg+xml");
    expect(stored.size).toBe(6);
  });

  it("streams a ReadableStream body to disk", async () => {
    const body = new Blob(["streamed bytes"]).stream();
    await files.upload("stream.bin", body);
    const stored = await files.download("stream.bin");
    expect(await stored.text()).toBe("streamed bytes");
  });

  it("serves byte ranges", async () => {
    await files.upload("range.txt", "0123456789");
    const part = await files.download("range.txt", {
      range: { start: 2, end: 5 },
    });
    expect(await part.text()).toBe("2345");
    expect(part.size).toBe(4);
  });

  it("lists manually dropped files with extension-derived types", async () => {
    await mkdir(path.join(root, "manual"));
    await writeFile(path.join(root, "manual", "photo.png"), "png-bytes");
    const listing = await files.list({ prefix: "manual/", delimiter: "/" });
    expect(listing.items.map((item) => [item.key, item.type])).toEqual([
      ["manual/photo.png", "image/png"],
    ]);
  });

  it("collapses folders into prefixes with a delimiter", async () => {
    await files.upload("a/one.txt", "1");
    await files.upload("a/sub/two.txt", "2");
    await files.upload("top.txt", "t");
    const listing = await files.list({ prefix: "a/", delimiter: "/" });
    expect(listing.items.map((item) => item.key)).toEqual(["a/one.txt"]);
    expect(listing.prefixes).toEqual(["a/sub/"]);
  });

  it("throws NotFound when the root directory is missing", async () => {
    await rm(root, { recursive: true, force: true });
    await expect(files.list({ limit: 1 })).rejects.toMatchObject({
      code: "NotFound",
    });
  });

  it("rejects keys that escape the root", async () => {
    await expect(files.upload("../escape.txt", "x")).rejects.toMatchObject({
      code: "Provider",
    });
    await expect(files.download("../../etc/passwd")).rejects.toThrow();
  });

  it("head reports metadata without a body read", async () => {
    await files.upload("head.pdf", "%PDF");
    const meta = await files.head("head.pdf");
    expect(meta.size).toBe(4);
    expect(meta.type).toBe("application/pdf");
  });

  it("exists, copy, move and delete behave like an object store", async () => {
    await files.upload("src.txt", "body");
    expect(await files.exists("src.txt")).toBe(true);
    expect(await files.exists("missing.txt")).toBe(false);

    await files.copy("src.txt", "copies/dup.txt");
    expect(await (await files.download("copies/dup.txt")).text()).toBe("body");

    await files.move("copies/dup.txt", "moved.txt");
    expect(await files.exists("copies/dup.txt")).toBe(false);
    expect(await (await files.download("moved.txt")).text()).toBe("body");

    await files.delete("moved.txt");
    expect(await files.exists("moved.txt")).toBe(false);
  });

  it("download of a missing key throws NotFound", async () => {
    await expect(files.download("nope.txt")).rejects.toMatchObject({
      code: "NotFound",
    });
  });

  it("advertises the capabilities the routes gate on", async () => {
    expect(files.capabilities.signedUrl.supported).toBe(false);
    expect(files.capabilities.rangeRead).toBe(true);
    expect(files.capabilities.delimiter).toBe(true);
  });

  it("upload creates a real directory for .keep folder markers", async () => {
    await files.upload("empty-folder/.keep", "");
    expect((await stat(path.join(root, "empty-folder"))).isDirectory()).toBe(
      true,
    );
    const listing = await files.list({ prefix: "", delimiter: "/" });
    expect(listing.prefixes).toEqual(["empty-folder/"]);
  });
});
