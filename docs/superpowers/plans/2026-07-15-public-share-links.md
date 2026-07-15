# Public Share Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the presigned-URL "copy link" with first-class public share links: a DB-backed token (`/s/<token>`) that is revocable, expirable, optionally password-protected, and works for every provider (S3 via short presigned redirect, SFTP/FTP/WebDAV via streaming).

**Architecture:** A new `Share` row is the capability — the app URL is stable, the presigned URL becomes a 60-second internal redirect detail. Two public entry points only: the landing page `/s/[token]` and the download route `/api/s/[token]/download`. Everything else (create, revoke, list) stays behind the session. Shared infra in `src/lib/shares/` + `src/lib/dal/shares.ts`; creation UI lives in the browser feature (it's a file action), public page + management in a new `features/shares/` feature.

**Tech Stack:** Next.js 16 (App Router, typed routes), Prisma 7 (PostgreSQL), better-auth, TanStack Form kit (`src/forms/`), zod 4, vitest, node:crypto (scrypt, HMAC).

## Global Constraints

- **Read `ARCHITECTURE.md` and the relevant guides in `node_modules/next/dist/docs/` before coding** — this Next.js version has breaking changes (params are Promises, `RouteContext<"/api/…">` typed route handlers).
- No cross-feature imports (Biome-enforced). `features/browser` must not import `features/shares` and vice versa; shared code goes in `src/lib/`.
- Prisma only inside `src/lib/dal/` (and `src/lib/auth/`).
- Mutations = server actions returning `ActionResult` (`src/lib/action-result.ts`), zod-validated, permissions re-checked server-side.
- Reads = RSC or GET route + TanStack Query. Never a server action for a read.
- Forms = `useAppForm` from `src/forms/form.ts`.
- Public endpoints answer uniform 404 (`notFound()` / `apiError(404, "Not found.")`) whether the token is unknown, expired, or revoked.
- All user-facing copy in **English** (matches the existing UI).
- Verify each task with `pnpm typecheck && pnpm lint && pnpm test`; run `pnpm build` at the end. Do NOT run E2E — the user tests the UI manually.
- `pnpm db:migrate` needs the dev PostgreSQL up (`DATABASE_URL` in `.env`). If it is unreachable, stop and ask the user to start it — do not hand-write migration SQL.

---

### Task 1: Pure share libs — token, password hash, expiry

**Files:**
- Create: `src/lib/shares/token.ts`
- Create: `src/lib/shares/token.test.ts`
- Create: `src/lib/shares/password.ts`
- Create: `src/lib/shares/password.test.ts`
- Create: `src/lib/shares/expiry.ts`
- Create: `src/lib/shares/expiry.test.ts`

**Interfaces:**
- Produces: `generateShareToken(): string` — 22-char base64url token.
- Produces: `hashSharePassword(password: string): string`, `verifySharePassword(password: string, stored: string): boolean`.
- Produces: `SHARE_EXPIRY_OPTIONS` (readonly `{value,label}[]`), `type ShareExpiry = "1d" | "7d" | "30d" | "never"`, `expiresAtFrom(expiry: ShareExpiry, now: Date): Date | null`.

- [ ] **Step 1: Write the failing tests**

`src/lib/shares/token.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateShareToken } from "./token";

describe("generateShareToken", () => {
  it("returns a 22-char url-safe token", () => {
    expect(generateShareToken()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("never repeats", () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => generateShareToken()),
    );
    expect(tokens.size).toBe(200);
  });
});
```

`src/lib/shares/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashSharePassword, verifySharePassword } from "./password";

describe("share passwords", () => {
  it("verifies the password it hashed", () => {
    const stored = hashSharePassword("hunter2");
    expect(verifySharePassword("hunter2", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashSharePassword("hunter2");
    expect(verifySharePassword("hunter3", stored)).toBe(false);
  });

  it("salts: two hashes of the same password differ", () => {
    expect(hashSharePassword("same")).not.toBe(hashSharePassword("same"));
  });

  it("rejects malformed stored values instead of throwing", () => {
    expect(verifySharePassword("x", "not-a-hash")).toBe(false);
    expect(verifySharePassword("x", "")).toBe(false);
  });
});
```

`src/lib/shares/expiry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { expiresAtFrom, SHARE_EXPIRY_OPTIONS } from "./expiry";

describe("expiresAtFrom", () => {
  const now = new Date("2026-07-15T12:00:00Z");

  it("maps 1d/7d/30d to the right instant", () => {
    expect(expiresAtFrom("1d", now)?.toISOString()).toBe(
      "2026-07-16T12:00:00.000Z",
    );
    expect(expiresAtFrom("7d", now)?.toISOString()).toBe(
      "2026-07-22T12:00:00.000Z",
    );
    expect(expiresAtFrom("30d", now)?.toISOString()).toBe(
      "2026-08-14T12:00:00.000Z",
    );
  });

  it("never → null (permanent link)", () => {
    expect(expiresAtFrom("never", now)).toBeNull();
  });

  it("every option value is accepted", () => {
    for (const option of SHARE_EXPIRY_OPTIONS) {
      expect(() => expiresAtFrom(option.value, now)).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/shares`
Expected: FAIL — modules `./token`, `./password`, `./expiry` not found.

- [ ] **Step 3: Implement the three modules**

`src/lib/shares/token.ts`:

```ts
import { randomBytes } from "node:crypto";

/** 128 bits of entropy, url-safe — the token IS the capability. */
export function generateShareToken(): string {
  return randomBytes(16).toString("base64url");
}
```

`src/lib/shares/password.ts`:

```ts
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Stored as `base64url(salt).base64url(scrypt(password, salt))` — no external
// dependency, and scrypt's work factor is enough for a share-link password.

export function hashSharePassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, 32);
  return `${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

export function verifySharePassword(
  password: string,
  stored: string,
): boolean {
  const [saltPart, hashPart] = stored.split(".");
  if (!saltPart || !hashPart) return false;
  try {
    const salt = Buffer.from(saltPart, "base64url");
    const expected = Buffer.from(hashPart, "base64url");
    if (expected.length === 0) return false;
    const actual = scryptSync(password.normalize("NFKC"), salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
```

`src/lib/shares/expiry.ts`:

```ts
// Lifetimes offered by the share dialog. Shared by the dialog (options), the
// server action (zod enum over the values) and nothing else — extend here.

export const SHARE_EXPIRY_OPTIONS = [
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "never", label: "Never" },
] as const;

export type ShareExpiry = (typeof SHARE_EXPIRY_OPTIONS)[number]["value"];

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_MS: Record<Exclude<ShareExpiry, "never">, number> = {
  "1d": DAY_MS,
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
};

/** null = the link never expires. */
export function expiresAtFrom(expiry: ShareExpiry, now: Date): Date | null {
  if (expiry === "never") return null;
  return new Date(now.getTime() + EXPIRY_MS[expiry]);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/shares`
Expected: PASS (3 files, 9 tests).

- [ ] **Step 5: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

```bash
git add src/lib/shares
git commit -m "feat(shares): token, password-hash and expiry primitives"
```

---

### Task 2: Prisma `Share` model + DAL

**Files:**
- Modify: `prisma/schema.prisma` (add model after `SourcePermission`, add relation on `Source`)
- Create: `src/lib/dal/shares.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.
- Produces: `createShare(input: ShareInput): Promise<void>`, `getActiveShare(token: string)`, `getShareWithSource(id: string)`, `listSharesFor(viewer: {id: string; role?: string | null})`, `revokeShare(id: string): Promise<void>`, `countShareDownload(id: string): Promise<void>`. Rows are Prisma `Share` records; `listSharesFor`/`getShareWithSource` include `source: { name } | null`-shaped data via the relation.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

In `model Source`, after the `grants SourcePermission[]` line, add:

```prisma
  shares Share[]
```

At the end of the file, add:

```prisma
/// Public share link — the app-minted token (the row id) is the capability:
/// anyone holding the URL passes, and expiry/revocation/password on the row
/// gate it. Deleting a source cascades and kills its links; createdById has
/// no FK so links survive account deletion (mirrors Operation.userId).
model Share {
  id           String    @id
  sourceId     String    @map("source_id") @db.Uuid
  key          String
  createdById  String    @map("created_by_id")
  expiresAt    DateTime? @map("expires_at") @db.Timestamptz(3)
  passwordHash String?   @map("password_hash")
  revokedAt    DateTime? @map("revoked_at") @db.Timestamptz(3)
  downloads    Int       @default(0)
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  source Source @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  @@index([sourceId])
  @@index([createdById])
  @@map("shares")
}
```

- [ ] **Step 2: Run the migration**

Run: `pnpm db:migrate --name add_shares`
Expected: `Your database is now in sync with your schema` and a new folder under `prisma/migrations/`. (Also regenerates the client; if the DB is down, stop and ask the user.)

- [ ] **Step 3: Write the DAL**

`src/lib/dal/shares.ts`:

```ts
import "server-only";
import { prisma } from "@/lib/prisma";

export interface ShareInput {
  /** The public token (generateShareToken()). */
  id: string;
  sourceId: string;
  key: string;
  createdById: string;
  expiresAt: Date | null;
  passwordHash: string | null;
}

export async function createShare(input: ShareInput): Promise<void> {
  await prisma.share.create({ data: input });
}

/**
 * The public lookup: token → live share. Unknown, revoked and expired all
 * return null alike — public surfaces answer a uniform 404 from it.
 */
export async function getActiveShare(token: string) {
  const share = await prisma.share.findUnique({ where: { id: token } });
  if (!share) return null;
  if (share.revokedAt) return null;
  if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) return null;
  return share;
}

/** Management lookup — includes the source name (null once deleted). */
export async function getShareWithSource(id: string) {
  return prisma.share.findUnique({
    where: { id },
    include: { source: { select: { name: true } } },
  });
}

/** Owners see their links; admins see everyone's. */
export async function listSharesFor(viewer: {
  id: string;
  role?: string | null;
}) {
  return prisma.share.findMany({
    where: viewer.role === "admin" ? {} : { createdById: viewer.id },
    include: { source: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeShare(id: string): Promise<void> {
  await prisma.share.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

export async function countShareDownload(id: string): Promise<void> {
  await prisma.share.update({
    where: { id },
    data: { downloads: { increment: 1 } },
  });
}
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green (the generated client now has `prisma.share`).

```bash
git add prisma src/lib/dal/shares.ts
git commit -m "feat(shares): Share model, migration and DAL"
```

---

### Task 3: Password-unlock cookie helper

**Files:**
- Create: `src/lib/shares/unlock.ts`

**Interfaces:**
- Produces: `grantUnlock(token: string): Promise<void>` (sets the HttpOnly cookie), `isUnlocked(token: string): Promise<boolean>`. Both usable from server actions, RSC pages and route handlers (they use `next/headers`).

- [ ] **Step 1: Implement**

`src/lib/shares/unlock.ts`:

```ts
import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";

// Proof-of-password cookie: value = HMAC(token) under ENCRYPTION_KEY, so it
// can't be forged without the server key and is worthless for any other
// share. Reads process.env directly, mirroring lib/crypto.ts.

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "ENCRYPTION_KEY must be 64 hex characters. Generate one with: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

function unlockValue(token: string): string {
  return createHmac("sha256", getKey())
    .update(`share-unlock:${token}`)
    .digest("base64url");
}

function cookieName(token: string): string {
  return `share_unlock_${token}`;
}

/** Re-prompt after an hour — long enough to finish a big download. */
const UNLOCK_MAX_AGE_SECONDS = 60 * 60;

export async function grantUnlock(token: string): Promise<void> {
  (await cookies()).set(cookieName(token), unlockValue(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Must cover both /s/<token> (page) and /api/s/<token>/download.
    path: "/",
    maxAge: UNLOCK_MAX_AGE_SECONDS,
  });
}

export async function isUnlocked(token: string): Promise<boolean> {
  const value = (await cookies()).get(cookieName(token))?.value;
  return value === unlockValue(token);
}
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

```bash
git add src/lib/shares/unlock.ts
git commit -m "feat(shares): HMAC unlock cookie for password-protected links"
```

---

### Task 4: Admin setting "Public share links"

**Files:**
- Modify: `src/lib/dal/settings.ts`
- Modify: `src/features/admin/actions.ts`
- Modify: `src/features/admin/components/settings-form.tsx`
- Modify: `src/app/(app)/admin/settings/page.tsx`

**Interfaces:**
- Produces: `isPublicSharingEnabled(): Promise<boolean>` (**default true**), `setPublicSharingEnabled(enabled: boolean): Promise<void>` in the DAL; `setPublicSharing(enabled: boolean): Promise<ActionResult>` admin action.

- [ ] **Step 1: DAL — add to `src/lib/dal/settings.ts`** (below the OIDC block):

```ts
const SHARING_KEY = "publicSharing";

/**
 * Whether signed-in users may mint public share links. Defaults to true —
 * an admin can switch it off from Admin → Settings to keep the instance
 * strictly private. Existing links stop resolving while it's off is NOT
 * implied: only creation is gated (revoke links individually).
 */
export async function isPublicSharingEnabled(): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { key: SHARING_KEY },
    select: { value: true },
  });
  return row?.value !== "false";
}

export async function setPublicSharingEnabled(
  enabled: boolean,
): Promise<void> {
  await setBoolSetting(SHARING_KEY, enabled);
}
```

- [ ] **Step 2: Admin action — add to `src/features/admin/actions.ts`** (next to `setSignUpEnabled`; import `setPublicSharingEnabled` from `@/lib/dal/settings`):

```ts
export async function setPublicSharing(
  enabled: boolean,
): Promise<ActionResult> {
  if (!(await currentAdmin())) return actionError(NOT_AUTHORIZED);

  try {
    await setPublicSharingEnabled(enabled === true);
  } catch (error) {
    console.error("[admin] toggle public sharing failed:", error);
    return actionError("Could not update this setting.");
  }
  return actionOk();
}
```

- [ ] **Step 3: Settings UI** — in `src/features/admin/components/settings-form.tsx`, add a `sharingEnabled: boolean` prop, import `setPublicSharing`, and append a third `SettingRow` after the OIDC one:

```tsx
      <SettingRow
        title="Public share links"
        description="Let users with access to a source create public links to its files (revocable, expirable, optionally password-protected). Turning this off blocks creating new links — existing ones keep working until revoked or expired."
        checked={sharingEnabled}
        disabled={pending}
        onChange={(enabled) =>
          run(
            () => setPublicSharing(enabled),
            enabled ? "Public share links enabled" : "Public share links disabled",
          )
        }
      />
```

- [ ] **Step 4: Page wiring** — in `src/app/(app)/admin/settings/page.tsx`, add `isPublicSharingEnabled` to the imports and the `Promise.all`, pass `sharingEnabled={sharingEnabled}` to `<SettingsForm>`.

- [ ] **Step 5: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

```bash
git add src/lib/dal/settings.ts src/features/admin
git add "src/app/(app)/admin/settings/page.tsx"
git commit -m "feat(admin): public share links setting (default on)"
```

---

### Task 5: `createShareLink` server action

**Files:**
- Modify: `src/features/browser/actions.ts`
- Modify: `src/lib/dal/operations.ts` (extend `OperationAction`)

**Interfaces:**
- Consumes: Task 1 libs, Task 2 DAL, `isPublicSharingEnabled` (Task 4), `requireSourceAccess`, `getSession` from `@/lib/auth/session`, `getFilesClient`.
- Produces: `createShareLink(sourceId: string, key: string, options: { expiresIn: ShareExpiry; password?: string }): Promise<ActionResult<{ token: string }>>` — the client builds the URL with `window.location.origin`.

- [ ] **Step 1: Extend the audit union** — in `src/lib/dal/operations.ts`, add to `OperationAction`:

```ts
  | "share-create"
  | "share-revoke";
```

- [ ] **Step 2: Add the action** to `src/features/browser/actions.ts` (new imports: `z` from `zod`; `createShare` from `@/lib/dal/shares`; `isPublicSharingEnabled` from `@/lib/dal/settings`; `expiresAtFrom`, `SHARE_EXPIRY_OPTIONS`, type `ShareExpiry` from `@/lib/shares/expiry`; `hashSharePassword` from `@/lib/shares/password`; `generateShareToken` from `@/lib/shares/token`; `getSession` from `@/lib/auth/session`):

```ts
const shareOptionsSchema = z.object({
  expiresIn: z.enum(SHARE_EXPIRY_OPTIONS.map((o) => o.value)),
  // Trimmed; empty means "no password".
  password: z.string().trim().max(128).optional(),
});

/**
 * Mints a public share link for one object. A read grant is enough — sharing
 * exposes nothing the creator couldn't already download — but the instance-
 * wide switch (Admin → Settings) can turn the feature off entirely.
 */
export async function createShareLink(
  sourceId: string,
  key: string,
  options: { expiresIn: ShareExpiry; password?: string },
): Promise<ActionResult<{ token: string }>> {
  const parsed = shareOptionsSchema.safeParse(options);
  if (!parsed.success) return actionError("Invalid share options.");

  if (!(await isPublicSharingEnabled())) {
    return actionError("Public share links are disabled on this instance.");
  }
  const session = await getSession();
  const result = await requireSourceAccess(sourceId);
  if (!session || !result) return actionError("Source not found.");
  const { source } = result;

  const files = getFilesClient(source);
  try {
    if (!(await files.exists(key))) {
      return actionError("This file no longer exists.");
    }
  } catch (error) {
    console.error(`[share] exists check failed (source=${source.id}):`, error);
    return actionError("Could not reach this source.");
  }

  const token = generateShareToken();
  const expiresAt = expiresAtFrom(parsed.data.expiresIn, new Date());
  const password = parsed.data.password || undefined;
  await createShare({
    id: token,
    sourceId: source.id,
    key,
    createdById: session.user.id,
    expiresAt,
    passwordHash: password ? hashSharePassword(password) : null,
  });
  await recordOperation({
    action: "share-create",
    sourceId: source.id,
    sourceName: source.name,
    target: key,
    detail: expiresAt
      ? `expires ${expiresAt.toISOString().slice(0, 10)}`
      : "no expiry",
  });
  return actionOk({ token });
}
```

Note: `z.enum` over a mapped array needs a tuple in zod 4 — if `z.enum(SHARE_EXPIRY_OPTIONS.map(...))` fails typecheck, use the literal `z.enum(["1d", "7d", "30d", "never"])` and keep `SHARE_EXPIRY_OPTIONS` as the UI source of truth (they are asserted in the same file by the `ShareExpiry` type).

- [ ] **Step 3: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

```bash
git add src/features/browser/actions.ts src/lib/dal/operations.ts
git commit -m "feat(shares): createShareLink server action"
```

---

### Task 6: Public download route + proxy exclusion

**Files:**
- Modify: `src/proxy.ts`
- Create: `src/features/shares/lib/preview.ts`
- Create: `src/app/api/s/[token]/download/route.ts`

**Interfaces:**
- Consumes: `getActiveShare`, `countShareDownload` (Task 2), `isUnlocked` (Task 3), `streamObject`, `getFilesClient`, `getSource`, `apiError`, `categoryOf`.
- Produces: `GET /api/s/[token]/download` (`?inline=1` honored only for image/pdf/video/audio); `sharePreviewKind(category: string | undefined): SharePreviewKind | null` with `type SharePreviewKind = "image" | "pdf" | "video" | "audio"`.

- [ ] **Step 1: Open the proxy to the two public prefixes** — in `src/proxy.ts` replace the matcher with:

```ts
export const config = {
  // Everything except the public endpoints (auth flow, health probe, public
  // share links), the auth pages themselves, and static assets.
  matcher: [
    "/((?!api/auth|api/health|api/s/|s/|sign-in|sign-up|forgot-password|reset-password|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

- [ ] **Step 2: Preview-kind helper** — `src/features/shares/lib/preview.ts`:

```ts
// Categories the public share page renders inline — the same safe set the
// browser preview uses: <img>/<video>/<audio> never execute content and the
// PDF goes into a sandboxed iframe / CSP-sandboxed stream.

export type SharePreviewKind = "image" | "pdf" | "video" | "audio";

const KINDS = new Set<string>(["image", "pdf", "video", "audio"]);

export function sharePreviewKind(
  category: string | undefined,
): SharePreviewKind | null {
  return category && KINDS.has(category)
    ? (category as SharePreviewKind)
    : null;
}
```

- [ ] **Step 3: Download route** — `src/app/api/s/[token]/download/route.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { categoryOf } from "@/features/browser/lib/file-types";
import { streamObject } from "@/features/browser/server/stream";
import { sharePreviewKind } from "@/features/shares/lib/preview";
import { apiError } from "@/lib/api-error";
import { countShareDownload, getActiveShare } from "@/lib/dal/shares";
import { getSource } from "@/lib/dal/sources";
import { isUnlocked } from "@/lib/shares/unlock";
import { getFilesClient } from "@/lib/storage/client";

/** Presigned lifetime behind the stable /s/ URL — just long enough for the
 * browser to follow the redirect; the app URL is what people share. */
const REDIRECT_TTL_SECONDS = 60;

/**
 * The public download endpoint. The token is the whole authorization: no
 * session, uniform 404 for unknown/expired/revoked. Providers that can sign
 * redirect to a short-lived presigned URL (no bytes through the app); the
 * rest (SFTP, FTP, WebDAV) stream with Range support.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/s/[token]/download">,
) {
  const { token } = await ctx.params;
  const share = await getActiveShare(token);
  if (!share) return apiError(404, "Not found.");
  if (share.passwordHash && !(await isUnlocked(token))) {
    return apiError(401, "This link is password-protected.");
  }
  const source = await getSource(share.sourceId);
  if (!source) return apiError(404, "Not found.");

  const filename = share.key.split("/").pop() || "file";
  const inline =
    request.nextUrl.searchParams.get("inline") === "1" &&
    sharePreviewKind(categoryOf(filename)) !== null;
  const disposition = inline ? "inline" : "attachment";

  // Count real downloads once — not the landing page's inline preview, and
  // not every Range request a seeking <video> fires.
  if (!inline && !request.headers.get("range")) {
    await countShareDownload(share.id);
  }

  const files = getFilesClient(source);
  try {
    if (files.capabilities.signedUrl.supported) {
      const url = await files.url(share.key, {
        expiresIn: REDIRECT_TTL_SECONDS,
        responseContentDisposition: `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      });
      return NextResponse.redirect(url);
    }
    return await streamObject(files, share.key, {
      filename,
      disposition,
      rangeHeader: request.headers.get("range"),
    });
  } catch (error) {
    if ((error as { code?: string }).code === "NotFound") {
      return apiError(404, "Not found.");
    }
    console.error(`[share-download] failed (share=${share.id}):`, error);
    return apiError(502, "Could not download this file.");
  }
}
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green (`next typegen` picks up the new typed route).

```bash
git add src/proxy.ts src/features/shares "src/app/api/s"
git commit -m "feat(shares): public download route behind stable tokens"
```

---

### Task 7: Public landing page `/s/[token]`

**Files:**
- Create: `src/features/shares/actions.ts` (`unlockShare` only for now)
- Create: `src/features/shares/components/share-password-form.tsx`
- Create: `src/features/shares/components/public-share-card.tsx`
- Create: `src/app/s/[token]/page.tsx`

**Interfaces:**
- Consumes: Tasks 1–3, 6; `useAppForm`; `formatBytes` from `@/lib/format`.
- Produces: `unlockShare(token: string, password: string): Promise<ActionResult>`; `<PublicShareCard token filename size preview />` (RSC); `<SharePasswordForm token />` (client).

- [ ] **Step 1: Unlock action** — `src/features/shares/actions.ts`:

```ts
"use server";

import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { getActiveShare } from "@/lib/dal/shares";
import { verifySharePassword } from "@/lib/shares/password";
import { grantUnlock } from "@/lib/shares/unlock";

/**
 * Trades the share's password for the unlock cookie. Public by design (the
 * visitor has no session); the uniform error never confirms a token exists.
 */
export async function unlockShare(
  token: string,
  password: string,
): Promise<ActionResult> {
  const share = await getActiveShare(token);
  if (!share?.passwordHash) {
    return actionError("This link is no longer available.");
  }
  if (!verifySharePassword(password, share.passwordHash)) {
    // Blunt brute-force damper — enough for a share-link password.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return actionError("Wrong password.");
  }
  await grantUnlock(token);
  return actionOk();
}
```

- [ ] **Step 2: Password form** — `src/features/shares/components/share-password-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { unlockShare } from "@/features/shares/actions";
import { useAppForm } from "@/forms/form";

const schema = z.object({
  password: z.string().min(1, "Password is required."),
});

export function SharePasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const form = useAppForm({
    defaultValues: { password: "" },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      const result = await unlockShare(token, value.password);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // The cookie is set — re-render the page server-side, now unlocked.
      router.refresh();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">
        This link is password-protected.
      </p>
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label="Password"
            type="password"
            autoComplete="off"
            autoFocus
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton pendingLabel="Unlocking…">Unlock</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}
```

- [ ] **Step 3: Share card (RSC)** — `src/features/shares/components/public-share-card.tsx`:

```tsx
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SharePreviewKind } from "@/features/shares/lib/preview";
import { formatBytes } from "@/lib/format";

export function PublicShareCard({
  token,
  filename,
  size,
  preview,
}: {
  token: string;
  filename: string;
  size: number;
  /** null → no inline preview, just the download button. */
  preview: SharePreviewKind | null;
}) {
  const downloadHref = `/api/s/${token}/download`;
  const inlineSrc = `/api/s/${token}/download?inline=1`;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="break-all text-base font-semibold">{filename}</h1>
        <p className="text-sm text-muted-foreground">{formatBytes(size)}</p>
      </div>

      {preview ? (
        <div className="flex items-center justify-center overflow-hidden rounded-md border bg-muted/40">
          {preview === "image" ? (
            // biome-ignore lint/performance/noImgElement: streamed/presigned object, not optimizable
            <img
              src={inlineSrc}
              alt={filename}
              className="max-h-[60vh] w-auto max-w-full object-contain"
            />
          ) : preview === "video" ? (
            // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
            <video src={inlineSrc} controls className="max-h-[60vh] w-full bg-black" />
          ) : preview === "audio" ? (
            // biome-ignore lint/a11y/useMediaCaption: arbitrary bucket objects carry no caption tracks
            <audio src={inlineSrc} controls className="w-full px-6 py-10" />
          ) : (
            // Empty sandbox: renders the PDF, blocks any smuggled scripts.
            <iframe
              src={inlineSrc}
              sandbox=""
              title={filename}
              className="h-[60vh] w-full"
            />
          )}
        </div>
      ) : null}

      <Button asChild className="w-full">
        <a href={downloadHref}>
          <Download aria-hidden />
          Download
        </a>
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: The page** — `src/app/s/[token]/page.tsx`:

```tsx
import { Cylinder } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categoryOf } from "@/features/browser/lib/file-types";
import { PublicShareCard } from "@/features/shares/components/public-share-card";
import { SharePasswordForm } from "@/features/shares/components/share-password-form";
import { sharePreviewKind } from "@/features/shares/lib/preview";
import { getActiveShare } from "@/lib/dal/shares";
import { getSource } from "@/lib/dal/sources";
import { isUnlocked } from "@/lib/shares/unlock";
import { getFilesClient } from "@/lib/storage/client";

export const metadata: Metadata = { title: "Shared file" };

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Uniform notFound() for unknown, revoked and expired alike.
  const share = await getActiveShare(token);
  if (!share) notFound();

  if (share.passwordHash && !(await isUnlocked(token))) {
    return (
      <ShareShell>
        <SharePasswordForm token={token} />
      </ShareShell>
    );
  }

  const source = await getSource(share.sourceId);
  if (!source) notFound();

  const filename = share.key.split("/").pop() || "file";
  let size: number;
  try {
    size = (await getFilesClient(source).head(share.key)).size;
  } catch {
    // The object is gone (or the source is unreachable) — the link is dead.
    notFound();
  }

  return (
    <ShareShell>
      <PublicShareCard
        token={token}
        filename={filename}
        size={size}
        preview={sharePreviewKind(categoryOf(filename))}
      />
    </ShareShell>
  );
}

function ShareShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Cylinder className="size-4" aria-hidden />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Bucket UI
          </span>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
```

Note (typecheck): `notFound()` returns `never`, so `size` is definitely assigned; if tsc complains about the try/catch assignment, initialize `let size = 0` and keep the `notFound()` in the catch.

- [ ] **Step 5: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

```bash
git add src/features/shares "src/app/s"
git commit -m "feat(shares): public landing page with password gate and inline preview"
```

---

### Task 8: Share dialog in the browser + retire the presigned copy-link

**Files:**
- Create: `src/features/browser/components/share-dialog.tsx`
- Modify: `src/features/browser/components/file-browser.tsx`
- Modify: `src/features/browser/components/preview-dialog.tsx:211-221` (footer button)
- Modify: `src/features/browser/components/browser-columns.tsx:34,200,256-262` (meta callback + row action)
- Modify: `src/features/browser/components/file-grid.tsx:52-65,114,255-266,366-372` (same, both call sites)
- Modify: `src/app/(app)/source/[id]/page.tsx:53-55` (canShare now = setting, not provider)
- Delete: `src/app/api/sources/[id]/share/route.ts`
- Modify: `src/features/browser/api/client.ts` (drop `fetchShareUrl`)
- Modify: `src/features/browser/api/queries.ts` (drop `shareUrl`)
- Modify: `src/features/browser/lib/limits.ts` (drop `SHARE_TTL_SECONDS`)

**Interfaces:**
- Consumes: `createShareLink` (Task 5), `SHARE_EXPIRY_OPTIONS`/`ShareExpiry` (Task 1), `useAppForm`.
- Produces: `<ShareDialog sourceId file onOpenChange />`; the table/grid/preview callback renames `onCopyLink` → `onShare` (same `(file: FileEntry) => void` shape).

- [ ] **Step 1: The dialog** — `src/features/browser/components/share-dialog.tsx`:

```tsx
"use client";

import { useStore } from "@tanstack/react-form";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createShareLink } from "@/features/browser/actions";
import type { FileEntry } from "@/features/browser/lib/listing";
import { useAppForm } from "@/forms/form";
import { SHARE_EXPIRY_OPTIONS, type ShareExpiry } from "@/lib/shares/expiry";

const shareSchema = z.object({
  expiresIn: z.enum(["1d", "7d", "30d", "never"]),
  password: z.string().max(128),
});

export function ShareDialog({
  sourceId,
  file,
  onOpenChange,
}: {
  sourceId: string;
  file: FileEntry | null;
  onOpenChange: (open: boolean) => void;
}) {
  // Once minted, the dialog switches to the copy view until closed.
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useAppForm({
    defaultValues: { expiresIn: "7d" as ShareExpiry, password: "" },
    validators: { onChange: shareSchema },
    onSubmit: async ({ value }) => {
      if (!file) return;
      const result = await createShareLink(sourceId, file.key, {
        expiresIn: value.expiresIn,
        password: value.password.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCreatedUrl(`${window.location.origin}/s/${result.data.token}`);
    },
  });
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  const close = (open: boolean) => {
    if (isSubmitting) return;
    if (!open) {
      form.reset();
      setCreatedUrl(null);
      setCopied(false);
    }
    onOpenChange(open);
  };

  const copy = async () => {
    if (!createdUrl) return;
    await navigator.clipboard.writeText(createdUrl);
    setCopied(true);
    toast.success("Link copied");
  };

  return (
    <Dialog open={file !== null} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">
            Share {file?.name}
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can download this file — no account needed.
            Manage links from Shared links.
          </DialogDescription>
        </DialogHeader>

        {createdUrl ? (
          <div className="flex items-center gap-2">
            <Input readOnly value={createdUrl} className="font-mono text-sm" />
            <Button type="button" variant="outline" size="icon" onClick={copy}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              <span className="sr-only">Copy link</span>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.AppField name="expiresIn">
              {(field) => (
                <field.SelectField
                  label="Expires"
                  options={SHARE_EXPIRY_OPTIONS}
                />
              )}
            </form.AppField>
            <form.AppField name="password">
              {(field) => (
                <field.TextField
                  label="Password (optional)"
                  type="password"
                  autoComplete="off"
                  placeholder="Leave empty for none"
                />
              )}
            </form.AppField>
            <DialogFooter>
              <form.AppForm>
                <form.SubmitButton pendingLabel="Creating…">
                  Create link
                </form.SubmitButton>
              </form.AppForm>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Rename the callback across the browser UI.** Mechanical, same shape everywhere:
  - `browser-columns.tsx`: `onCopyLink?:` → `onShare?:` (line 34 and the destructuring at 200); the row action at 256-262 becomes `onClick={() => onShare(entry)}`, `aria-label={`Share ${entry.name}`}`, `title="Share"`. Swap the `Link2` icon for `Share2` (lucide) if `Link2` was used there.
  - `file-grid.tsx`: same rename at both prop declarations (52-65, 255-266), the pass-through (114) and the action button (366-372).
  - `preview-dialog.tsx`: prop `onCopyLink` → `onShare`, footer button label `Copy link` → `Share`, icon `Link2` → `Share2`.

- [ ] **Step 3: Rewire `file-browser.tsx`:**
  - Delete `handleCopyLink` (lines 178-192) and the now-unused `queryClient` fetch of `browserQueries.shareUrl`.
  - Add state `const [shareTarget, setShareTarget] = useState<FileEntry | null>(null);`
  - Table meta: `onShare: canShare ? setShareTarget : undefined,` (was `onCopyLink: canShare ? handleCopyLink : undefined`); same swap for the `FileGrid` (line 463) and `PreviewDialog` (line 496) props.
  - Render the dialog next to the others:

```tsx
      <ShareDialog
        sourceId={sourceId}
        file={shareTarget}
        onOpenChange={(open) => {
          if (!open) setShareTarget(null);
        }}
      />
```

  - Update the `canShare` prop doc: `/** False when the admin switched public share links off. */`

- [ ] **Step 4: Page gate** — in `src/app/(app)/source/[id]/page.tsx`, replace lines 53-55 with:

```ts
  // Sharing is app-minted now (streaming fallback covers unsigned providers),
  // so the only gate is the instance-wide switch in Admin → Settings.
  const canShare = await isPublicSharingEnabled();
```

Import `isPublicSharingEnabled` from `@/lib/dal/settings`; drop the now-unused `getFilesClient` import if nothing else in the file uses it.

- [ ] **Step 5: Delete the legacy endpoint and its client plumbing:**
  - Delete `src/app/api/sources/[id]/share/route.ts` (the whole `share/` folder).
  - `src/features/browser/api/client.ts`: remove `fetchShareUrl`.
  - `src/features/browser/api/queries.ts`: remove `shareUrl` and its import.
  - `src/features/browser/lib/limits.ts`: remove `SHARE_TTL_SECONDS`.

- [ ] **Step 6: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green — typecheck is the safety net for the rename; fix any leftover `onCopyLink`/`fetchShareUrl` reference it flags.

```bash
git add -A src/features/browser src/app src/lib
git commit -m "feat(shares): share dialog replaces presigned copy-link"
```

---

### Task 9: "Shared links" management page + sidebar entry

**Files:**
- Modify: `src/features/shares/actions.ts` (add `revokeShareLink`)
- Create: `src/features/shares/components/shares-table.tsx`
- Create: `src/app/(app)/shares/page.tsx`
- Modify: `src/components/layout/app-sidebar.tsx:134-157` (footer menu)

**Interfaces:**
- Consumes: `listSharesFor`, `getShareWithSource`, `revokeShare` (Task 2), `requireSession`/`getSession`/`isAdmin` from `@/lib/auth/session`, `recordOperation`.
- Produces: `revokeShareLink(id: string): Promise<ActionResult>`; `interface ShareRow { id; key; sourceName; createdAt: number; expiresAt: number | null; revoked: boolean; downloads: number; hasPassword: boolean }` consumed by `<SharesTable shares={ShareRow[]} />`.

- [ ] **Step 1: Revoke action** — append to `src/features/shares/actions.ts` (add imports: `getSession`, `isAdmin` from `@/lib/auth/session`; `getShareWithSource`, `revokeShare` from `@/lib/dal/shares`; `recordOperation` from `@/lib/dal/operations`):

```ts
/** Owners revoke their own links; admins revoke anyone's. Uniform error. */
export async function revokeShareLink(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return actionError("Link not found.");
  const share = await getShareWithSource(id);
  if (
    !share ||
    (share.createdById !== session.user.id && !isAdmin(session.user))
  ) {
    return actionError("Link not found.");
  }
  if (!share.revokedAt) {
    await revokeShare(id);
    await recordOperation({
      action: "share-revoke",
      sourceId: share.sourceId,
      sourceName: share.source?.name ?? "(deleted source)",
      target: share.key,
    });
  }
  return actionOk();
}
```

- [ ] **Step 2: Table component** — `src/features/shares/components/shares-table.tsx`:

```tsx
"use client";

import { Copy, Link2Off } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { revokeShareLink } from "@/features/shares/actions";
import { formatDate } from "@/lib/format";

export interface ShareRow {
  id: string;
  key: string;
  sourceName: string;
  createdAt: number;
  expiresAt: number | null;
  revoked: boolean;
  downloads: number;
  hasPassword: boolean;
}

function statusOf(share: ShareRow): "active" | "expired" | "revoked" {
  if (share.revoked) return "revoked";
  if (share.expiresAt !== null && share.expiresAt <= Date.now()) {
    return "expired";
  }
  return "active";
}

export function SharesTable({ shares }: { shares: ShareRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const copy = async (id: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/s/${id}`);
    toast.success("Link copied");
  };

  const revoke = (id: string) => {
    startTransition(async () => {
      const result = await revokeShareLink(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Link revoked");
      router.refresh();
    });
  };

  if (shares.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        No share links yet — create one from a file's Share action.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Downloads</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shares.map((share) => {
            const status = statusOf(share);
            const name = share.key.split("/").pop() || share.key;
            return (
              <TableRow key={share.id}>
                <TableCell className="max-w-64">
                  <span className="block truncate font-medium" title={share.key}>
                    {name}
                  </span>
                  {share.hasPassword ? (
                    <span className="text-xs text-muted-foreground">
                      password-protected
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{share.sourceName}</TableCell>
                <TableCell>{formatDate(share.createdAt)}</TableCell>
                <TableCell>
                  {share.expiresAt === null
                    ? "Never"
                    : formatDate(share.expiresAt)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {share.downloads}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={status === "active" ? "secondary" : "outline"}
                  >
                    {status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => copy(share.id)}
                      disabled={status !== "active"}
                      aria-label={`Copy link to ${name}`}
                      title="Copy link"
                    >
                      <Copy aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => revoke(share.id)}
                      disabled={pending || status === "revoked"}
                      aria-label={`Revoke link to ${name}`}
                      title="Revoke"
                    >
                      <Link2Off aria-hidden />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

(If `@/components/ui/badge` or `@/components/ui/table` don't exist yet, add them with `pnpm dlx shadcn@latest add badge table` — check `src/components/ui/` first.)

- [ ] **Step 3: The page** — `src/app/(app)/shares/page.tsx` (structure mirrors `account/page.tsx`):

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  type ShareRow,
  SharesTable,
} from "@/features/shares/components/shares-table";
import { requireSession } from "@/lib/auth/session";
import { listSharesFor } from "@/lib/dal/shares";

export const metadata: Metadata = { title: "Shared links" };

export default async function SharesPage() {
  const session = await requireSession();
  const shares = await listSharesFor(session.user);
  const rows: ShareRow[] = shares.map((share) => ({
    id: share.id,
    key: share.key,
    sourceName: share.source?.name ?? "(deleted source)",
    createdAt: share.createdAt.getTime(),
    expiresAt: share.expiresAt?.getTime() ?? null,
    revoked: share.revokedAt !== null,
    downloads: share.downloads,
    hasPassword: share.passwordHash !== null,
  }));

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-sm font-medium">Shared links</h1>
      </header>

      <main className="flex-1 bg-muted/20">
        <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-6">
          <PageHeader
            title="Shared links"
            description="Public links you created. Revoking one kills it immediately for everyone."
          />
          <SharesTable shares={rows} />
        </div>
      </main>
    </>
  );
}
```

Note: admins see everyone's links (that's `listSharesFor`'s contract); if the viewer is an admin, the description reads slightly narrow but stays correct enough — adjust to "Public links on this instance." behind `session.user.role === "admin"` if trivial.

- [ ] **Step 4: Sidebar entry** — in `src/components/layout/app-sidebar.tsx`, add `Link2` to the lucide import and restructure the footer so the link shows for everyone (replace the `{admin ? (<SidebarMenu>…</SidebarMenu>) : null}` block, lines 135-157):

```tsx
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/shares"}>
              <Link href="/shares">
                <Link2 className="size-4" aria-hidden />
                Shared links
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {admin ? (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/activity"}>
                  <Link href="/activity">
                    <History className="size-4" aria-hidden />
                    Activity
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith("/admin")}
                >
                  <Link href="/admin/users">
                    <Settings2 className="size-4" aria-hidden />
                    Admin
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : null}
        </SidebarMenu>
```

- [ ] **Step 5: Final verification and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green, build succeeds.

```bash
git add src/features/shares "src/app/(app)/shares" src/components/layout/app-sidebar.tsx
git commit -m "feat(shares): shared-links management page and sidebar entry"
```

Then hand the UI to the user for manual testing (create link with/without password, open in a private window, revoke, expired behavior, SFTP source streaming, admin toggle off).
