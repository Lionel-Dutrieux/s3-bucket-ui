import "server-only";
import type { Files } from "files-sdk";

/**
 * Content types never served inline from the app origin: unlike a presigned
 * bucket URL, a streamed body is same-origin, so an inline HTML/SVG/XML
 * document could execute scripts with the viewer's session (stored XSS).
 */
const INLINE_BLOCKED = /html|svg|xml/i;

interface ByteRange {
  start: number;
  /** Inclusive, capped to the object's last byte. */
  end: number;
}

/** `Range: bytes=a-b` → a satisfiable range, or null (→ serve the whole body). */
function parseRange(header: string | null, size: number): ByteRange | null {
  if (!header || size <= 0) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(header);
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (start >= size || start > end) return null;
  return { start, end };
}

/**
 * Streams one object through the app — the fallback for providers with no
 * presigned-URL primitive (SFTP, FTP, WebDAV). Honors `Range` requests when
 * the adapter can seek (video scrubbing, resumed downloads), forces unsafe
 * types to an attachment, and sandboxes any inline document context.
 * The caller has already authorized access; a missing key throws a
 * FilesError with code "NotFound" for the route to map.
 */
export async function streamObject(
  files: Files,
  key: string,
  options: {
    filename: string;
    disposition: "inline" | "attachment";
    rangeHeader?: string | null;
  },
): Promise<Response> {
  const stat = await files.head(key);
  const type = stat.type || "application/octet-stream";
  const disposition =
    options.disposition === "inline" && INLINE_BLOCKED.test(type)
      ? "attachment"
      : options.disposition;

  const headers = new Headers({
    "Content-Type": type,
    "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(options.filename)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    // A scriptless sandbox for anything that does render as a document
    // (e.g. the PDF viewer); ignored by <img>/<video>/<audio> loads.
    "Content-Security-Policy": "sandbox",
  });
  if (files.capabilities.rangeRead) {
    headers.set("Accept-Ranges", "bytes");
  }

  const range = files.capabilities.rangeRead
    ? parseRange(options.rangeHeader ?? null, stat.size)
    : null;
  if (range) {
    const stored = await files.download(key, { range, as: "stream" });
    headers.set(
      "Content-Range",
      `bytes ${range.start}-${range.end}/${stat.size}`,
    );
    headers.set("Content-Length", String(range.end - range.start + 1));
    return new Response(stored.stream(), { status: 206, headers });
  }

  const stored = await files.download(key, { as: "stream" });
  if (stat.size > 0) headers.set("Content-Length", String(stat.size));
  return new Response(stored.stream(), { status: 200, headers });
}
