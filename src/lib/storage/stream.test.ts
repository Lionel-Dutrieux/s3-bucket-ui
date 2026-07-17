import type { Files } from "files-sdk";
import { describe, expect, it } from "vitest";
import { streamObject } from "@/lib/storage/stream";

function fakeFiles(type: string): Files {
  return {
    capabilities: { rangeRead: false, signedUrl: { supported: false } },
    head: async () => ({ type, size: 4 }),
    download: async () => ({
      stream: () => new Blob(["%PDF"]).stream(),
    }),
  } as unknown as Files;
}

describe("streamObject", () => {
  it("serves PDFs inline without the CSP sandbox that blocks Chrome's viewer", async () => {
    const res = await streamObject(fakeFiles("application/pdf"), "doc.pdf", {
      filename: "doc.pdf",
      disposition: "inline",
    });
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("forces the pdf content type when the provider reports a generic one", async () => {
    const res = await streamObject(
      fakeFiles("application/octet-stream"),
      "doc.pdf",
      {
        filename: "doc.pdf",
        disposition: "inline",
        contentType: "application/pdf",
      },
    );
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("still forces HTML to a sandboxed attachment", async () => {
    const res = await streamObject(fakeFiles("text/html"), "page.pdf", {
      filename: "page.pdf",
      disposition: "inline",
    });
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Security-Policy")).toBe("sandbox");
  });
});
