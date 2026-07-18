# Local Filesystem Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Local folder" source type (files-sdk `fs` adapter) so an operator can expose server/container directories, gated by an operator-controlled `LOCAL_FS_ROOTS` env allowlist.

**Architecture:** A new `local` provider (adapter `"fs"`) joins the existing registry in `src/lib/storage/providers.ts`; `buildAdapter()` maps it to files-sdk's `fs({ root })` where the generic `bucket` field holds the root path. The fs adapter reports `signedUrl.supported: false`, so every existing capability-driven path (download redirect vs stream, preview, shares, upload through the app) works unchanged. Security: source create/update/test re-validate server-side that the root resolves (realpath) under one of the `LOCAL_FS_ROOTS` allowlisted directories; the provider card is hidden from the picker when the variable is unset.

**Tech Stack:** Next.js (App Router, RSC), files-sdk (`files-sdk/fs`), zod 4, TanStack Form, next-intl, Prisma, vitest.

## Global Constraints

- Read `node_modules/next/dist/docs/` guides before writing Next.js code you're unsure about (this Next version has breaking changes vs training data).
- No cross-feature imports, no barrel files (Biome `noRestrictedImports` enforces). Shared infra lives in `src/lib/`.
- Mutations = server actions returning `ActionResult` (`src/lib/action-result.ts`), zod-validated, permissions re-checked server-side (`currentAdmin()` for source actions).
- Every UI string through next-intl; keys added to **all five** locale files: `messages/en.json`, `fr.json`, `de.json`, `es.json`, `zh.json`. Pure `lib/` modules expose keys or English fallback messages exactly like the existing code does (zod messages in `schema.ts` are English literals — keep that convention).
- Provider `fieldLabels` and picker hints are hard-coded English (existing convention) — do NOT i18n those.
- Verify with `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Never run E2E — the user tests the UI manually.
- Commit after each task with a conventional-commit message.

---

### Task 1: `LOCAL_FS_ROOTS` env + allowlist module

**Files:**
- Modify: `src/lib/env.ts`
- Create: `src/lib/storage/local-roots.ts`
- Test: `src/lib/storage/local-roots.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `localFsRoots(): string[]` and `checkLocalRoot(rootPath: string): Promise<LocalRootCheck>` where `LocalRootCheck = { ok: true; value: string } | { ok: false; reason: "disabled" | "outside" | "unreachable" }`. Task 4 (actions) consumes `checkLocalRoot`; Task 5 (UI) consumes `localFsRoots` from the RSC page.
- Note: the module reads `process.env.LOCAL_FS_ROOTS` directly (same pattern as `src/lib/crypto.ts`) so tests can set the variable per-test; `src/lib/env.ts` only declares/validates it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/storage/local-roots.test.ts` (look at `src/lib/crypto.test.ts` for the env-juggling pattern and `src/lib/storage/region.test.ts` for vitest conventions in this folder):

```ts
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkLocalRoot, localFsRoots } from "@/lib/storage/local-roots";

let base: string;
const originalEnv = process.env.LOCAL_FS_ROOTS;

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), "local-roots-"));
});

afterEach(async () => {
  process.env.LOCAL_FS_ROOTS = originalEnv;
  if (originalEnv === undefined) delete process.env.LOCAL_FS_ROOTS;
  await rm(base, { recursive: true, force: true });
});

describe("localFsRoots", () => {
  it("returns [] when the variable is unset", () => {
    delete process.env.LOCAL_FS_ROOTS;
    expect(localFsRoots()).toEqual([]);
  });

  it("splits on commas, trims, drops empties and resolves paths", () => {
    process.env.LOCAL_FS_ROOTS = ` ${base} , ,${base}${path.sep}sub `;
    expect(localFsRoots()).toEqual([
      path.resolve(base),
      path.resolve(base, "sub"),
    ]);
  });
});

describe("checkLocalRoot", () => {
  it("fails with 'disabled' when no roots are configured", async () => {
    delete process.env.LOCAL_FS_ROOTS;
    expect(await checkLocalRoot(base)).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("accepts an allowed root itself and returns its real path", async () => {
    process.env.LOCAL_FS_ROOTS = base;
    const check = await checkLocalRoot(base);
    expect(check).toMatchObject({ ok: true });
  });

  it("accepts a subdirectory of an allowed root", async () => {
    process.env.LOCAL_FS_ROOTS = base;
    const sub = path.join(base, "team", "photos");
    await mkdir(sub, { recursive: true });
    const check = await checkLocalRoot(sub);
    expect(check).toMatchObject({ ok: true });
  });

  it("rejects a path outside every allowed root", async () => {
    const allowed = path.join(base, "allowed");
    const outside = path.join(base, "outside");
    await mkdir(allowed);
    await mkdir(outside);
    process.env.LOCAL_FS_ROOTS = allowed;
    expect(await checkLocalRoot(outside)).toEqual({
      ok: false,
      reason: "outside",
    });
  });

  it("rejects ../ traversal that escapes the allowed root", async () => {
    const allowed = path.join(base, "allowed");
    await mkdir(allowed);
    process.env.LOCAL_FS_ROOTS = allowed;
    const sneaky = path.join(allowed, "..", "allowed-sibling");
    await mkdir(path.join(base, "allowed-sibling"));
    expect(await checkLocalRoot(sneaky)).toEqual({
      ok: false,
      reason: "outside",
    });
  });

  it("rejects a sibling whose name shares the allowed root as a prefix", async () => {
    const allowed = path.join(base, "data");
    const sibling = path.join(base, "data-secret");
    await mkdir(allowed);
    await mkdir(sibling);
    process.env.LOCAL_FS_ROOTS = allowed;
    expect(await checkLocalRoot(sibling)).toEqual({
      ok: false,
      reason: "outside",
    });
  });

  it("rejects a symlink inside an allowed root pointing outside it", async () => {
    const allowed = path.join(base, "allowed");
    const secret = path.join(base, "secret");
    await mkdir(allowed);
    await mkdir(secret);
    await writeFile(path.join(secret, "f.txt"), "x");
    process.env.LOCAL_FS_ROOTS = allowed;
    const link = path.join(allowed, "escape");
    try {
      await symlink(secret, link, "dir");
    } catch {
      return; // symlink creation needs privileges on some Windows setups — skip
    }
    expect(await checkLocalRoot(link)).toEqual({
      ok: false,
      reason: "outside",
    });
  });

  it("fails with 'unreachable' when the directory does not exist", async () => {
    process.env.LOCAL_FS_ROOTS = base;
    expect(await checkLocalRoot(path.join(base, "missing"))).toEqual({
      ok: false,
      reason: "unreachable",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/storage/local-roots.test.ts`
Expected: FAIL — cannot resolve `@/lib/storage/local-roots`.

- [ ] **Step 3: Implement the module**

Create `src/lib/storage/local-roots.ts`:

```ts
import "server-only";
import { realpath } from "node:fs/promises";
import path from "node:path";

// Operator-controlled allowlist for "Local folder" sources. Read straight
// from process.env (not lib/env) so tests can vary it per-case — same
// pattern as lib/crypto.ts. env.ts still declares it for boot validation.

/** Absolute, resolved allowlist roots. Empty array = feature disabled. */
export function localFsRoots(): string[] {
  return (process.env.LOCAL_FS_ROOTS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
}

export type LocalRootCheck =
  | { ok: true; value: string }
  | { ok: false; reason: "disabled" | "outside" | "unreachable" };

/**
 * Validates a "Local folder" root path against LOCAL_FS_ROOTS. Resolves
 * symlinks on both sides (realpath) so `../` tricks and links pointing out
 * of an allowed root are caught; on success returns the canonical path to
 * store, so every later adapter call starts from a vetted directory.
 */
export async function checkLocalRoot(
  rootPath: string,
): Promise<LocalRootCheck> {
  const allowed = localFsRoots();
  if (allowed.length === 0) return { ok: false, reason: "disabled" };

  let resolved: string;
  try {
    resolved = await realpath(path.resolve(rootPath));
  } catch {
    return { ok: false, reason: "unreachable" };
  }

  for (const root of allowed) {
    let realRoot: string;
    try {
      realRoot = await realpath(root);
    } catch {
      continue; // configured root missing on disk — never matches
    }
    if (resolved === realRoot || resolved.startsWith(realRoot + path.sep)) {
      return { ok: true, value: resolved };
    }
  }
  return { ok: false, reason: "outside" };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/storage/local-roots.test.ts`
Expected: PASS (the symlink test may short-circuit on Windows without symlink privileges — that early `return` is deliberate).

- [ ] **Step 5: Declare the variable in `src/lib/env.ts` and `.env.example`**

In `src/lib/env.ts`, add to the `server` block after `SMTP_FROM`:

```ts
    /** Comma-separated directory allowlist for "Local folder" sources.
     *  Unset = the local provider is hidden and rejected. */
    LOCAL_FS_ROOTS: z.string().optional(),
```

and to `runtimeEnv`:

```ts
    LOCAL_FS_ROOTS: process.env.LOCAL_FS_ROOTS,
```

In `.env.example`, append (after the SMTP block, matching its comment style):

```bash
# --- Optional: local filesystem sources ---
# Comma-separated allowlist of directories that "Local folder" sources may
# expose (e.g. volumes mounted into the container). Unset = the provider is
# hidden from the admin UI and rejected server-side. Every source root must
# be one of these directories or live under one.
#LOCAL_FS_ROOTS=/data,/srv/media
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/env.ts src/lib/storage/local-roots.ts src/lib/storage/local-roots.test.ts .env.example
git commit -m "feat(storage): LOCAL_FS_ROOTS allowlist for local filesystem sources"
```

---

### Task 2: `local` provider in the registry + fs adapter wiring

**Files:**
- Modify: `src/lib/storage/providers.ts`
- Modify: `src/lib/storage/client.ts`
- Test: `src/lib/storage/providers.test.ts` (extend)

**Interfaces:**
- Consumes: nothing new.
- Produces: provider id `"local"` with `adapter: "fs"`; `ProviderDefinition.adapter` union gains `"fs"`; `normalizeEndpoint("local", anything)` returns `{ ok: true, value: "" }`. Tasks 3–5 rely on `getProvider(id)?.adapter === "fs"` as THE discriminator for local sources.

- [ ] **Step 1: Write the failing tests**

In `src/lib/storage/providers.test.ts`, add (follow the file's existing describe/it style):

```ts
describe("local provider", () => {
  it("is registered with the fs adapter", () => {
    expect(getProvider("local")?.adapter).toBe("fs");
  });

  it("normalizeEndpoint accepts an empty endpoint and blanks it", () => {
    expect(normalizeEndpoint("local", "")).toEqual({ ok: true, value: "" });
  });

  it("normalizeEndpoint blanks a stray non-empty endpoint", () => {
    expect(normalizeEndpoint("local", "https://ignored.example.com")).toEqual({
      ok: true,
      value: "",
    });
  });
});
```

(Import `getProvider` alongside the file's existing imports if not already there.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/storage/providers.test.ts`
Expected: FAIL — `getProvider("local")` is undefined, and `normalizeEndpoint("local", "")` returns `{ ok: false, message: "Must be a valid URL." }`.

- [ ] **Step 3: Implement in `providers.ts`**

1. Widen the adapter union:

```ts
  adapter: "s3" | "azure" | "sftp" | "ftp" | "webdav" | "fs";
```

2. Append the provider entry at the end of `PROVIDERS`, after the `webdav` entry:

```ts
  {
    // Server filesystem folder (Docker volume, mounted share). No endpoint,
    // no credentials — "bucket" holds the root path, which the source
    // actions validate against the LOCAL_FS_ROOTS allowlist (server-only,
    // lib/storage/local-roots.ts). Hidden from the picker when unset.
    id: "local",
    label: "Local folder",
    adapter: "fs",
    endpointPlaceholder: "",
    fieldLabels: {
      bucket: "Root path",
      accessKeyId: "Username",
      secretAccessKey: "Password",
    },
  },
```

(`accessKeyId`/`secretAccessKey` labels are never rendered for this provider — the form hides those fields in Task 5 — but the type requires them.)

3. In `normalizeEndpoint`, add a case to the `switch` before `default`:

```ts
    case "fs":
      // Local sources have no endpoint; whatever was typed is discarded.
      return { ok: true, value: "" };
```

**Careful:** `normalizeEndpoint` currently does `new URL(raw)` BEFORE the switch and fails on empty strings — move the fs case above the URL parsing, i.e. restructure the top of the function to:

```ts
export function normalizeEndpoint(
  providerId: string,
  raw: string,
): EndpointCheck {
  const adapter = getProvider(providerId)?.adapter ?? "s3";
  // Local sources have no endpoint; whatever was typed is discarded.
  if (adapter === "fs") return { ok: true, value: "" };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, message: "Must be a valid URL." };
  }

  const hostPort = `${url.hostname}${url.port ? `:${url.port}` : ""}`;
  switch (adapter) {
    // ... existing cases unchanged (webdav / sftp / ftp / default)
  }
}
```

4. Update the doc comment above `normalizeEndpoint` to mention fs sources have no endpoint.

- [ ] **Step 4: Wire the adapter in `client.ts`**

Add the import (alphabetical with the others):

```ts
import { fs } from "files-sdk/fs";
```

Add the branch in `buildAdapter`, right after the `webdav` branch and before the `region` computation:

```ts
  // Local sources: "bucket" holds a root directory already vetted against
  // LOCAL_FS_ROOTS by the source actions (lib/storage/local-roots.ts).
  // The adapter itself re-fences: keys resolving outside root throw.
  if (provider?.adapter === "fs") {
    return fs({ root: credentials.bucket });
  }
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm vitest run src/lib/storage/providers.test.ts && pnpm typecheck`
Expected: tests PASS. Typecheck may surface exhaustiveness errors on the new `"fs"` union member (e.g. in `provider-catalog.ts` groupings) — if any appear, note them; they are fixed in their own tasks. If the only errors are in files Task 5 owns, proceed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/providers.ts src/lib/storage/providers.test.ts src/lib/storage/client.ts
git commit -m "feat(storage): register Local folder provider backed by the files-sdk fs adapter"
```

---

### Task 3: Provider-conditional source schema

**Files:**
- Modify: `src/features/sources/lib/schema.ts`
- Test: `src/features/sources/lib/schema.test.ts` (extend)

**Interfaces:**
- Consumes: `getProvider`, `normalizeEndpoint` from `@/lib/storage/providers` (Task 2's `"fs"` adapter).
- Produces: same exported names (`sourceInputSchema`, `sourceUpdateSchema`, `SourceFormValues`) — the form and actions keep compiling unchanged. For a provider whose adapter is `"fs"`: `endpoint`, `accessKeyId`, `secretAccessKey` are NOT required and are transformed to `""`; `bucket` (root path) stays required. For every other provider the current rules are byte-for-byte preserved (including the exact error messages).

- [ ] **Step 1: Write the failing tests**

In `src/features/sources/lib/schema.test.ts`, add:

```ts
describe("local (fs) sources", () => {
  const localInput = {
    name: "Media",
    provider: "local",
    endpoint: "",
    bucket: "/data/media",
    accessKeyId: "",
    secretAccessKey: "",
    allowPublicShares: true,
  };

  it("accepts a local source without endpoint or credentials", () => {
    const parsed = sourceInputSchema.safeParse(localInput);
    expect(parsed.success).toBe(true);
  });

  it("still requires the root path", () => {
    const parsed = sourceInputSchema.safeParse({ ...localInput, bucket: " " });
    expect(parsed.success).toBe(false);
  });

  it("blanks a stray endpoint on parse", () => {
    const parsed = sourceInputSchema.safeParse({
      ...localInput,
      endpoint: "https://stray.example.com",
    });
    expect(parsed.success && parsed.data.endpoint).toBe("");
  });

  it("blanks stray credentials on parse", () => {
    const parsed = sourceInputSchema.safeParse({
      ...localInput,
      accessKeyId: "stray",
      secretAccessKey: "stray",
    });
    expect(parsed.success && parsed.data.accessKeyId).toBe("");
    expect(parsed.success && parsed.data.secretAccessKey).toBe("");
  });

  it("update schema accepts the same shape", () => {
    const parsed = sourceUpdateSchema.safeParse(localInput);
    expect(parsed.success).toBe(true);
  });
});

describe("non-local sources keep their requirements", () => {
  const s3Input = {
    name: "Bucket",
    provider: "minio",
    endpoint: "https://minio.example.com",
    bucket: "files",
    accessKeyId: "",
    secretAccessKey: "",
    allowPublicShares: true,
  };

  it("still requires the access key", () => {
    const parsed = sourceInputSchema.safeParse(s3Input);
    expect(parsed.success).toBe(false);
    expect(
      !parsed.success &&
        parsed.error.issues.some((i) => i.path[0] === "accessKeyId"),
    ).toBe(true);
  });

  it("still requires the secret on create but not on update", () => {
    const withKey = { ...s3Input, accessKeyId: "minioadmin" };
    expect(sourceInputSchema.safeParse(withKey).success).toBe(false);
    expect(sourceUpdateSchema.safeParse(withKey).success).toBe(true);
  });
});
```

(Use the file's existing imports; add any missing ones.)

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest run src/features/sources/lib/schema.test.ts`
Expected: the local-source tests FAIL (endpoint/accessKeyId/secretAccessKey `min(1)` reject empties); the non-local ones may already pass.

- [ ] **Step 3: Rewrite `schema.ts`**

Replace the file's schema construction with (keep the leading file comment, extend it with one line about fs sources):

```ts
import { z } from "zod";
import { getProvider, normalizeEndpoint } from "@/lib/storage/providers";

// Single source of truth for source validation: the add-source form validates
// against it on the client (TanStack Form standard-schema support) and the
// server actions re-parse raw input with it before touching storage.
//
// Which fields are required depends on the provider: object stores and
// protocol servers need an endpoint + credentials, local (fs) sources only a
// root path — so requirements live in an object-level superRefine rather
// than per-field rules, and the transform blanks whatever a provider
// ignores. The LOCAL_FS_ROOTS allowlist check is server-only and happens in
// the actions, not here.
const baseSourceSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  provider: z
    .string()
    .refine((id) => getProvider(id) !== undefined, "Unknown provider."),
  endpoint: z.string().trim(),
  bucket: z.string().trim().min(1, "Bucket is required."),
  accessKeyId: z.string().trim(),
  secretAccessKey: z.string().trim(),
  // Whether public share links may be minted for this source (default on).
  allowPublicShares: z.boolean(),
});

type BaseValues = z.infer<typeof baseSourceSchema>;

function isLocal(values: BaseValues): boolean {
  return getProvider(values.provider)?.adapter === "fs";
}

function withProviderRules<Schema extends typeof baseSourceSchema>(
  schema: Schema,
  { requireSecret }: { requireSecret: boolean },
) {
  return schema
    .superRefine((values, ctx) => {
      if (isLocal(values)) return; // root path (bucket) is the only field
      if (!values.endpoint) {
        ctx.addIssue({
          code: "custom",
          path: ["endpoint"],
          message: "Endpoint is required.",
        });
      } else {
        const checked = normalizeEndpoint(values.provider, values.endpoint);
        if (!checked.ok) {
          ctx.addIssue({
            code: "custom",
            path: ["endpoint"],
            message: checked.message,
          });
        }
      }
      if (!values.accessKeyId) {
        ctx.addIssue({
          code: "custom",
          path: ["accessKeyId"],
          message: "Access key is required.",
        });
      }
      if (requireSecret && !values.secretAccessKey) {
        ctx.addIssue({
          code: "custom",
          path: ["secretAccessKey"],
          message: "Secret is required.",
        });
      }
    })
    .transform((values) => {
      if (isLocal(values)) {
        // A provider switch mid-form can leave stray values behind; a local
        // source stores none of them.
        return { ...values, endpoint: "", accessKeyId: "", secretAccessKey: "" };
      }
      const checked = normalizeEndpoint(values.provider, values.endpoint);
      return checked.ok ? { ...values, endpoint: checked.value } : values;
    });
}

export const sourceInputSchema = withProviderRules(baseSourceSchema, {
  requireSecret: true,
});

// Editing an existing source: a blank secret means "keep the stored one".
export const sourceUpdateSchema = withProviderRules(baseSourceSchema, {
  requireSecret: false,
});

/** Raw form values (before parsing/normalization). */
export type SourceFormValues = z.input<typeof sourceInputSchema>;
```

- [ ] **Step 4: Run the full sources test file + typecheck**

Run: `pnpm vitest run src/features/sources && pnpm typecheck`
Expected: PASS. If pre-existing tests asserted the old field-level messages ("Access key is required." etc.), they still pass — the messages are identical, only their origin moved.

- [ ] **Step 5: Commit**

```bash
git add src/features/sources/lib/schema.ts src/features/sources/lib/schema.test.ts
git commit -m "feat(sources): provider-conditional validation for local folder sources"
```

---

### Task 4: Server actions enforce the allowlist

**Files:**
- Modify: `src/features/sources/actions.ts`
- Modify: `messages/en.json`, `messages/fr.json`, `messages/de.json`, `messages/es.json`, `messages/zh.json` (`sources.errors.*`)

**Interfaces:**
- Consumes: `checkLocalRoot` from `@/lib/storage/local-roots` (Task 1), `getProvider` from `@/lib/storage/providers`.
- Produces: `createSource` / `updateSource` / `testSourceConnection` reject local sources whose root fails `checkLocalRoot`, and store the canonical (realpath) root in `bucket`. New i18n keys: `sources.errors.localDisabled`, `sources.errors.localRootNotAllowed`, `sources.errors.localRootUnreachable`.

- [ ] **Step 1: Add the guard helper in `actions.ts`**

Add imports:

```ts
import { checkLocalRoot } from "@/lib/storage/local-roots";
import { getProvider } from "@/lib/storage/providers";
```

Add below `resolveUpdateInput` (reusing the `SourceErrorsT` alias):

```ts
/**
 * Local (fs) sources only: re-validates the root path against the
 * LOCAL_FS_ROOTS allowlist and swaps in its canonical realpath — the client
 * never gets to pick an arbitrary server directory. Other providers pass
 * through untouched.
 */
async function guardLocalSource(
  data: SourceInput,
  t: SourceErrorsT,
): Promise<{ data?: SourceInput; error?: string }> {
  if (getProvider(data.provider)?.adapter !== "fs") return { data };
  const check = await checkLocalRoot(data.bucket);
  if (!check.ok) {
    const messages = {
      disabled: t("localDisabled"),
      outside: t("localRootNotAllowed"),
      unreachable: t("localRootUnreachable"),
    } as const;
    return { error: messages[check.reason] };
  }
  return { data: { ...data, bucket: check.value } };
}
```

- [ ] **Step 2: Apply the guard in the three flows**

In `testSourceConnection`, after `data` is resolved (both branches) and before the `testConnection` call:

```ts
  const guarded = await guardLocalSource(data, t);
  if (!guarded.data) return actionError(guarded.error ?? t("invalidInput"));

  return (await testConnection(guarded.data))
    ? actionOk()
    : actionError(t("connectionFailed"));
```

In `createSource`, replace the block after the parse with:

```ts
  const guarded = await guardLocalSource(parsed.data, t);
  if (!guarded.data) return actionError(guarded.error ?? t("invalidInput"));

  if (!(await testConnection(guarded.data))) {
    return actionError(t("connectionFailed"));
  }

  await dalCreateSource(guarded.data);
```

In `updateSource`, replace the block after `resolveUpdateInput` with:

```ts
  const guarded = await guardLocalSource(resolved.data, t);
  if (!guarded.data) return actionError(guarded.error ?? t("invalidInput"));

  if (!(await testConnection(guarded.data))) {
    return actionError(t("connectionFailed"));
  }

  await dalUpdateSource(sourceId, guarded.data);
```

- [ ] **Step 3: Add the error keys to all five locale files**

In each `messages/*.json`, inside `sources.errors` (keep key order alphabetical-ish with neighbors; match each file's existing tone):

en:
```json
"localDisabled": "Local folder sources are disabled — set LOCAL_FS_ROOTS on the server to enable them.",
"localRootNotAllowed": "This path is not under any allowed root (LOCAL_FS_ROOTS).",
"localRootUnreachable": "This directory does not exist or cannot be read on the server."
```

fr:
```json
"localDisabled": "Les sources de type dossier local sont désactivées — définissez LOCAL_FS_ROOTS sur le serveur pour les activer.",
"localRootNotAllowed": "Ce chemin n'est sous aucune racine autorisée (LOCAL_FS_ROOTS).",
"localRootUnreachable": "Ce dossier n'existe pas ou n'est pas lisible sur le serveur."
```

de:
```json
"localDisabled": "Lokale Ordnerquellen sind deaktiviert — setzen Sie LOCAL_FS_ROOTS auf dem Server, um sie zu aktivieren.",
"localRootNotAllowed": "Dieser Pfad liegt unter keinem erlaubten Stammverzeichnis (LOCAL_FS_ROOTS).",
"localRootUnreachable": "Dieses Verzeichnis existiert nicht oder ist auf dem Server nicht lesbar."
```

es:
```json
"localDisabled": "Las fuentes de carpeta local están desactivadas — define LOCAL_FS_ROOTS en el servidor para activarlas.",
"localRootNotAllowed": "Esta ruta no está bajo ninguna raíz permitida (LOCAL_FS_ROOTS).",
"localRootUnreachable": "Este directorio no existe o no se puede leer en el servidor."
```

zh:
```json
"localDisabled": "本地文件夹源已禁用 — 在服务器上设置 LOCAL_FS_ROOTS 以启用。",
"localRootNotAllowed": "该路径不在任何允许的根目录（LOCAL_FS_ROOTS）之下。",
"localRootUnreachable": "该目录不存在，或服务器无法读取。"
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS. (No new unit test here: the action is a thin composition of `checkLocalRoot` — tested in Task 1 — and the existing flow; the repo does not unit-test server actions.)

- [ ] **Step 5: Commit**

```bash
git add src/features/sources/actions.ts messages
git commit -m "feat(sources): enforce the LOCAL_FS_ROOTS allowlist in source actions"
```

---

### Task 5: UI — provider picker gating + local form variant

**Files:**
- Modify: `src/features/sources/components/provider-catalog.ts`
- Modify: `src/features/sources/components/provider-icons.ts`
- Modify: `src/features/sources/components/provider-picker.tsx`
- Modify: `src/features/sources/components/source-dialog.tsx`
- Modify: `src/features/sources/components/add-source-button.tsx`
- Modify: `src/features/sources/components/source-card-actions.tsx`
- Modify: `src/features/sources/components/source-form.tsx`
- Modify: `src/app/(app)/admin/sources/page.tsx`
- Modify: `messages/en.json`, `fr.json`, `de.json`, `es.json`, `zh.json` (`sources.form.*`)

**Interfaces:**
- Consumes: `localFsRoots()` (Task 1, RSC only), provider `local` with `adapter: "fs"` (Task 2).
- Produces: a `localFsRoots: string[]` prop threaded RSC page → `AddSourceButton`/`SourceCardActions` → `SourceDialog` → `ProviderPicker` + `SourceForm`. `searchProviders(query, opts?: { localFsEnabled?: boolean })` hides the local card when disabled. The form for fs providers shows only Name + Root path + public-shares toggle. New i18n keys: `sources.form.localRootsHint`, `sources.form.localAccessNote`.

- [ ] **Step 1: Catalog + icon**

`provider-catalog.ts` — add to `CATALOG`:

```ts
  local: {
    hint: "Server filesystem folder",
    keywords: "local filesystem folder directory disk volume mount fs",
  },
```

Change `searchProviders` to accept options and filter:

```ts
export function searchProviders(
  query: string,
  opts?: { localFsEnabled?: boolean },
): ProviderGroup[] {
  const q = query.trim().toLowerCase();
  const matches = PROVIDERS.filter((def) => {
    if (def.adapter === "fs" && !opts?.localFsEnabled) return false;
    if (!q) return true;
    const { hint = "", keywords = "" } = CATALOG[def.id] ?? {};
    return `${def.label} ${def.id} ${hint} ${keywords}`
      .toLowerCase()
      .includes(q);
  });
  // ... rest unchanged (fs lands in "Servers & protocols": adapter !== s3/azure)
}
```

`provider-icons.ts` — import `FolderOpen` from lucide-react and add `local: FolderOpen` to `PROVIDER_ICONS`. (`provider-logos.tsx` needs no change: ids without a brand mark fall back to the lucide glyph on a neutral plate.)

- [ ] **Step 2: Thread the prop through the client components**

`provider-picker.tsx`:

```ts
export function ProviderPicker({
  onSelect,
  localFsEnabled,
}: {
  onSelect: (providerId: string) => void;
  localFsEnabled: boolean;
}) {
  // ...
  const groups = searchProviders(query, { localFsEnabled });
```

`source-dialog.tsx` — add to props:

```ts
  /** LOCAL_FS_ROOTS allowlist, threaded from the RSC page ([] = disabled). */
  localFsRoots?: string[];
```

destructure `localFsRoots = []`, then pass `localFsEnabled={localFsRoots.length > 0}` to `<ProviderPicker>` and `localFsRoots={localFsRoots}` to `<SourceForm>`.

`add-source-button.tsx` — accept and forward:

```ts
export function AddSourceButton({ localFsRoots }: { localFsRoots: string[] }) {
  // ...
  <SourceDialog open={open} onOpenChange={setOpen} localFsRoots={localFsRoots} />
```

`source-card-actions.tsx` — read the component first; add an optional `localFsRoots?: string[]` prop and forward it to the `SourceDialog` it renders for edit (same pattern as above). If `source-form-card.tsx` also renders a `SourceDialog`, thread it there too; if it's unused for dialogs, leave it.

- [ ] **Step 3: RSC page provides the roots**

`src/app/(app)/admin/sources/page.tsx`:

```ts
import { localFsRoots } from "@/lib/storage/local-roots";
// in the component body:
const fsRoots = localFsRoots();
// in JSX:
<AddSourceButton localFsRoots={fsRoots} />
// and on each card:
<SourceCardActions
  source={source}
  localFsRoots={fsRoots}
  ...
/>
```

- [ ] **Step 4: Form variant for fs providers**

In `source-form.tsx`, after `const definition = ...`:

```ts
  const isLocal = definition.adapter === "fs";
```

Then:
- Wrap the `endpoint` field: `{isLocal ? null : (<form.AppField name="endpoint">...)}`.
- Replace the credentials grid so a local source only shows the root path, full width, with the allowlist hint:

```tsx
      {isLocal ? (
        <form.AppField name="bucket">
          {(field) => (
            <field.TextField
              label={bucket}
              placeholder={localFsRoots[0] ?? "/data"}
              mono
            />
          )}
        </form.AppField>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* existing bucket + accessKeyId fields unchanged */}
        </div>
      )}
```

- Hide the `secretAccessKey` field the same way (`{isLocal ? null : (...)}`).
- Swap the note line:

```tsx
      <p className="text-xs text-muted-foreground">
        {isLocal
          ? t("form.localRootsHint", { roots: localFsRoots.join(", ") })
          : t("form.accessNote")}
      </p>
```

- Add the prop:

```ts
interface SourceFormProps {
  // ...existing
  /** LOCAL_FS_ROOTS allowlist ([] when the feature is disabled). */
  localFsRoots?: string[];
}
```

with `localFsRoots = []` in the destructuring.

The Test-connection button works as-is for local sources (probes a `list`), keep it visible.

- [ ] **Step 5: i18n form keys in all five locales**

`sources.form` additions —

en:
```json
"localRootsHint": "The path must be one of the allowed server directories ({roots}) or a folder inside one.",
"localAccessNote": "The app reads this folder with the server's own permissions — only expose directories meant to be browsed."
```
fr:
```json
"localRootsHint": "Le chemin doit être l'un des dossiers autorisés du serveur ({roots}) ou un sous-dossier de l'un d'eux.",
"localAccessNote": "L'application lit ce dossier avec les permissions du serveur — n'exposez que des répertoires destinés à être parcourus."
```
de:
```json
"localRootsHint": "Der Pfad muss eines der erlaubten Serververzeichnisse ({roots}) oder ein Unterordner davon sein.",
"localAccessNote": "Die App liest diesen Ordner mit den Berechtigungen des Servers — geben Sie nur Verzeichnisse frei, die durchsucht werden sollen."
```
es:
```json
"localRootsHint": "La ruta debe ser uno de los directorios permitidos del servidor ({roots}) o una carpeta dentro de uno de ellos.",
"localAccessNote": "La aplicación lee esta carpeta con los permisos del propio servidor — expón solo directorios pensados para navegarse."
```
zh:
```json
"localRootsHint": "路径必须是服务器允许的目录之一（{roots}），或其中的子文件夹。",
"localAccessNote": "应用将以服务器自身的权限读取此文件夹 — 请只暴露供浏览的目录。"
```

(If Step 4 ends up not using `localAccessNote`, still add it only if used — drop the key everywhere otherwise. Keep keys and usage in sync.)

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS. Also grep that no other caller of `searchProviders` broke: `rg "searchProviders" src`.

- [ ] **Step 7: Commit**

```bash
git add src/features/sources src/app/(app)/admin/sources/page.tsx messages
git commit -m "feat(sources): Local folder provider in the picker and a credentials-free form variant"
```

---

### Task 6: Docs + full verification

**Files:**
- Modify: `README.md` (env-var/config section, if it documents the others — read it first)
- Verify: whole repo

- [ ] **Step 1: Document `LOCAL_FS_ROOTS` in README.md**

Read `README.md`; if it has an environment-variable table/section (it documents SMTP/OIDC), add a row/paragraph for `LOCAL_FS_ROOTS` mirroring the `.env.example` comment: optional, comma-separated directory allowlist for "Local folder" sources; unset = feature hidden and rejected; for Docker, list the container-side mount paths (e.g. `/data`). If README has no env section, skip this step.

- [ ] **Step 2: Full verification**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all four PASS. Fix anything that fails before committing.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document LOCAL_FS_ROOTS for local folder sources"
```

(Skip the commit if README was untouched and nothing else changed.)

---

## Out of scope (deliberate)

- No new Prisma migration — local sources reuse the existing `Source` row shape (`endpoint`/keys stored as encrypted empty strings; `encrypt("")` is fine, AES-GCM handles empty plaintext).
- No changes to download/preview/upload/share routes — the fs adapter reports `signedUrl.supported: false` (verified in `node_modules/files-sdk/dist/fs/index.js`), so the existing capability-driven streaming fallback covers everything, including Range requests.
- No E2E; the user tests the UI manually (memory: user-tests-manually).
