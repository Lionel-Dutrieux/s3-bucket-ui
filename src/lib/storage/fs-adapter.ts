import "server-only";
import { createReadStream, createWriteStream, type Dirent } from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import {
  type Adapter,
  type Body,
  createStoredFile,
  FilesError,
  type StoredFile,
} from "files-sdk";
import { mapFsError } from "files-sdk/fs";

// Sidecar-free local filesystem adapter for "Local folder" sources. files-sdk
// ships an fs adapter, but it writes a `<file>.meta.json` sidecar next to
// every upload (to persist Content-Type/ETag) and hides those from listings —
// unacceptable pollution for a directory that other tools also read and
// write. This adapter keeps the directory byte-for-byte what the user sees:
// one file per object, Content-Type derived from the extension at read time,
// so files dropped in by hand list and preview exactly like uploaded ones.
// The key-fencing semantics (escape and symlink checks) mirror the stock
// adapter; errors are normalized through its exported mapFsError.

const EXTENSION_TYPES: Record<string, string> = {
  // images
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
  // audio / video
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/opus",
  wav: "audio/wav",
  avi: "video/x-msvideo",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp4: "video/mp4",
  ogv: "video/ogg",
  webm: "video/webm",
  // documents
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  epub: "application/epub+zip",
  htm: "text/html",
  html: "text/html",
  json: "application/json",
  md: "text/markdown",
  odp: "application/vnd.oasis.opendocument.presentation",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odt: "application/vnd.oasis.opendocument.text",
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  txt: "text/plain",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
  // code / misc
  css: "text/css",
  js: "text/javascript",
  ts: "text/plain", // video/mp2t by MIME registry, but .ts here is code
  // archives
  "7z": "application/x-7z-compressed",
  gz: "application/gzip",
  rar: "application/vnd.rar",
  tar: "application/x-tar",
  zip: "application/zip",
  // fonts
  otf: "font/otf",
  ttf: "font/ttf",
  woff: "font/woff",
  woff2: "font/woff2",
};

/** Content type a key will be served with, from its extension alone. */
export function contentTypeFor(key: string): string {
  const dot = key.lastIndexOf(".");
  if (dot === -1 || dot < key.lastIndexOf("/")) {
    return "application/octet-stream";
  }
  const extension = key.slice(dot + 1).toLowerCase();
  return EXTENSION_TYPES[extension] ?? "application/octet-stream";
}

const errorCode = (error: unknown): string | undefined =>
  (error as { code?: string } | null)?.code;

/** Lexical fence: the resolved path must stay strictly under root. */
function resolveKeyPath(root: string, key: string): string {
  const resolved = path.resolve(root, key);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new FilesError(
      "Provider",
      `fs: key escapes adapter root: ${JSON.stringify(key)}`,
    );
  }
  if (resolved === root) {
    throw new FilesError(
      "Provider",
      "fs: key resolves to the adapter root directory",
    );
  }
  return resolved;
}

/** Symlink fence for reads: the real path must also stay under the real root. */
async function realpathUnderRoot(
  root: string,
  target: string,
  key: string,
): Promise<string> {
  const [realRoot, realTarget] = await Promise.all([
    fsp.realpath(root),
    fsp.realpath(target),
  ]);
  const rootWithSep = realRoot.endsWith(path.sep)
    ? realRoot
    : realRoot + path.sep;
  if (realTarget !== realRoot && !realTarget.startsWith(rootWithSep)) {
    throw new FilesError(
      "Provider",
      `fs: key resolves outside adapter root: ${JSON.stringify(key)}`,
    );
  }
  return realTarget;
}

/** Depth-first walk yielding every file key under root, `/`-separated. */
async function* walk(root: string): AsyncGenerator<string> {
  const stack: string[] = [root];
  let first = true;
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) continue;
    let entries: Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (error) {
      // A vanished root is a dead source (surfaces as NotFound → health,
      // "bucket-missing" → browser); a subdirectory deleted mid-walk is a
      // benign race.
      if (errorCode(error) === "ENOENT" && !first) return;
      throw error;
    }
    first = false;
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile()) {
        yield path.relative(root, abs).split(path.sep).join("/");
      }
    }
  }
}

/**
 * Removes now-empty directories from `dir` up to (never including) root —
 * object-store semantics have no folders, so a delete or move that empties a
 * directory must not leave its skeleton on disk. `rmdir` only ever removes
 * empty directories, so a concurrent write simply stops the climb
 * (ENOTEMPTY), as does anything else going wrong — pruning is best-effort
 * cleanup, never worth failing the operation that triggered it.
 */
async function pruneEmptyDirs(root: string, dir: string): Promise<void> {
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  let current = dir;
  while (current !== root && current.startsWith(rootWithSep)) {
    try {
      await fsp.rmdir(current);
    } catch {
      return;
    }
    current = path.dirname(current);
  }
}

interface KeyPage {
  keys: string[];
  prefixes?: string[];
  cursor?: string;
}

/**
 * S3-style page over a sorted key list: with a delimiter, keys sharing a
 * segment collapse into common prefixes; keys and prefixes both consume the
 * limit budget, and the cursor is the last raw key consumed (same semantics
 * as files-sdk's internal pager, re-implemented since it isn't exported).
 */
export function pageKeys(
  sortedKeys: string[],
  options: {
    prefix?: string;
    delimiter?: string;
    cursor?: string;
    limit?: number;
  },
): KeyPage {
  const prefix = options.prefix ?? "";
  const limit = options.limit ?? 1000;
  const { cursor, delimiter } = options;
  const startIdx = cursor ? sortedKeys.findIndex((key) => key > cursor) : 0;
  const slice = startIdx === -1 ? [] : sortedKeys.slice(startIdx);

  if (!delimiter) {
    const keys = slice.slice(0, limit);
    const more = keys.length < slice.length;
    const last = keys.at(-1);
    return { keys, ...(more && last !== undefined && { cursor: last }) };
  }

  const keys: string[] = [];
  const prefixes: string[] = [];
  let budget = limit;
  let lastConsumed: string | undefined;
  let activeGroup: string | undefined;
  let scanned = 0;
  for (const key of slice) {
    if (activeGroup !== undefined && key.startsWith(activeGroup)) {
      lastConsumed = key;
      scanned += 1;
      continue;
    }
    if (budget === 0) break;
    activeGroup = undefined;
    const rest = key.slice(prefix.length);
    const d = rest.indexOf(delimiter);
    if (d === -1) {
      keys.push(key);
    } else {
      activeGroup = prefix + rest.slice(0, d + delimiter.length);
      prefixes.push(activeGroup);
    }
    lastConsumed = key;
    budget -= 1;
    scanned += 1;
  }
  const more = scanned < slice.length;
  return {
    keys,
    ...(prefixes.length > 0 && { prefixes }),
    ...(more && lastConsumed !== undefined && { cursor: lastConsumed }),
  };
}

async function bodyToBytes(
  body: Exclude<Body, ReadableStream>,
): Promise<Uint8Array> {
  if (typeof body === "string") return new TextEncoder().encode(body);
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
}

function statStoredFile(
  key: string,
  bodyPath: string,
  size: number,
  mtimeMs: number,
): StoredFile {
  return createStoredFile(
    { key, lastModified: mtimeMs, size, type: contentTypeFor(key) },
    {
      factory: async () => {
        try {
          const buf = await fsp.readFile(bodyPath);
          return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        } catch (error) {
          throw mapFsError(error);
        }
      },
      kind: "lazy",
    },
  );
}

export interface LocalFsOptions {
  /** Directory the adapter manages — already vetted against LOCAL_FS_ROOTS. */
  root: string;
}

export function localFs(opts: LocalFsOptions): Adapter<{ root: string }> {
  if (!opts.root) {
    throw new FilesError("Provider", "localFs adapter: missing `root`.");
  }
  const root = path.resolve(opts.root);

  return {
    name: "local-fs",
    raw: { root },
    supportsRange: true,
    supportsDelimiter: true,
    supportsServerSideCopy: true,
    signedUrl: { supported: false },

    async upload(key, body, uploadOpts) {
      const bodyPath = resolveKeyPath(root, key);
      try {
        await fsp.mkdir(path.dirname(bodyPath), { recursive: true });
        const tempPath = `${bodyPath}.${process.pid}.${Date.now()}.tmp`;
        let size: number;
        try {
          if (body instanceof ReadableStream) {
            await pipeline(
              // DOM ReadableStream vs node:stream/web nominal mismatch only.
              Readable.fromWeb(body as NodeWebReadableStream<Uint8Array>),
              createWriteStream(tempPath, { flags: "wx" }),
              { signal: uploadOpts?.signal ?? undefined },
            );
            size = (await fsp.stat(tempPath)).size;
          } else {
            const bytes = await bodyToBytes(body);
            size = bytes.byteLength;
            await fsp.writeFile(tempPath, bytes);
          }
          await fsp.rename(tempPath, bodyPath);
        } catch (error) {
          await fsp.rm(tempPath, { force: true }).catch(() => {});
          throw error;
        }
        return {
          contentType: contentTypeFor(key),
          key,
          lastModified: Date.now(),
          size,
        };
      } catch (error) {
        throw mapFsError(error);
      }
    },

    async download(key, downloadOpts) {
      const bodyPath = resolveKeyPath(root, key);
      try {
        const realPath = await realpathUnderRoot(root, bodyPath, key);
        const stat = await fsp.stat(realPath);
        const range = downloadOpts?.range;
        const size =
          range === undefined
            ? stat.size
            : Math.min(range.end ?? stat.size - 1, stat.size - 1) -
              range.start +
              1;
        const meta = {
          key,
          lastModified: stat.mtimeMs,
          size,
          type: contentTypeFor(key),
        };
        const openStream = () =>
          Readable.toWeb(
            createReadStream(
              realPath,
              range && { start: range.start, end: range.end },
            ),
          ) as ReadableStream<Uint8Array>;
        if (downloadOpts?.as === "stream") {
          return createStoredFile(meta, {
            factory: openStream,
            kind: "stream",
          });
        }
        const buf = await new Response(openStream()).arrayBuffer();
        return createStoredFile(
          { ...meta, size: buf.byteLength },
          { data: new Uint8Array(buf), kind: "buffer" },
        );
      } catch (error) {
        throw mapFsError(error);
      }
    },

    async head(key) {
      const bodyPath = resolveKeyPath(root, key);
      try {
        const realPath = await realpathUnderRoot(root, bodyPath, key);
        const stat = await fsp.stat(realPath);
        return statStoredFile(key, realPath, stat.size, stat.mtimeMs);
      } catch (error) {
        throw mapFsError(error);
      }
    },

    async exists(key) {
      const bodyPath = resolveKeyPath(root, key);
      try {
        await fsp.stat(await realpathUnderRoot(root, bodyPath, key));
        return true;
      } catch (error) {
        const mapped = mapFsError(error);
        if (mapped.code === "NotFound") return false;
        throw mapped;
      }
    },

    async delete(key) {
      const bodyPath = resolveKeyPath(root, key);
      try {
        await fsp.rm(bodyPath, { force: true });
        await pruneEmptyDirs(root, path.dirname(bodyPath));
      } catch (error) {
        throw mapFsError(error);
      }
    },

    async copy(from, to) {
      const fromPath = resolveKeyPath(root, from);
      const toPath = resolveKeyPath(root, to);
      try {
        const realFrom = await realpathUnderRoot(root, fromPath, from);
        await fsp.mkdir(path.dirname(toPath), { recursive: true });
        await fsp.copyFile(realFrom, toPath);
      } catch (error) {
        throw mapFsError(error);
      }
    },

    async move(from, to) {
      const fromPath = resolveKeyPath(root, from);
      const toPath = resolveKeyPath(root, to);
      try {
        await fsp.mkdir(path.dirname(toPath), { recursive: true });
        await fsp.rename(fromPath, toPath);
        await pruneEmptyDirs(root, path.dirname(fromPath));
      } catch (error) {
        throw mapFsError(error);
      }
    },

    async list(options) {
      const prefix = options?.prefix ?? "";
      const keys: string[] = [];
      try {
        for await (const key of walk(root)) {
          if (key.startsWith(prefix)) keys.push(key);
        }
      } catch (error) {
        throw mapFsError(error);
      }
      keys.sort();
      const page = pageKeys(keys, {
        prefix,
        cursor: options?.cursor,
        limit: options?.limit ?? 1000,
        delimiter: options?.delimiter,
      });
      const items: StoredFile[] = [];
      for (const key of page.keys) {
        const bodyPath = path.join(root, ...key.split("/"));
        try {
          const stat = await fsp.stat(bodyPath);
          items.push(statStoredFile(key, bodyPath, stat.size, stat.mtimeMs));
        } catch (error) {
          if (errorCode(error) === "ENOENT") continue; // deleted mid-page
          throw mapFsError(error);
        }
      }
      return {
        items,
        ...(page.prefixes && { prefixes: page.prefixes }),
        ...(page.cursor !== undefined && { cursor: page.cursor }),
      };
    },

    url() {
      // Nothing may hand out a URL to a server-local file; every route gates
      // on capabilities.signedUrl.supported and streams instead.
      return Promise.reject(
        new FilesError("Provider", "local-fs: url() is not supported."),
      );
    },

    signedUploadUrl() {
      return Promise.reject(
        new FilesError(
          "Provider",
          "local-fs: signedUploadUrl() is not supported.",
        ),
      );
    },
  };
}
