# Architecture

Bucket UI is a single Next.js 16 app (App Router, server components, server
actions). Pages read data on the server (RSC), mutations go through server
actions. Server actions are **never** used for reads: the few on-demand reads
a dialog needs after render (preview URLs, file details, text preview, source
config) come from GET route handlers under `app/api/sources/[id]/`, consumed
with TanStack Query through the typed fetchers in each feature's
`api/client.ts`.

Authentication is built in (better-auth): sessions live in the database,
sign-in/sign-up pages are public, everything else requires an account, and
source visibility is governed by **grants** (see Authorization below).

## Layers

All application code lives under `src/`; the repo root holds configuration
only.

```
src/app/          Routes only. Pages stay thin: parse params, call a
                  service/DAL, render feature components. Route handlers live
                  under app/api/ and delegate to feature/server modules.
src/features/     One folder per domain. Features may import from lib/,
                  forms/ and components/, never from app/ or from another
                  feature. Inside a feature:
    actions.ts    'use server' — thin server actions built with
                  next-safe-action (src/lib/safe-action.ts): declare an
                  .inputSchema() zod schema, delegate, return the action's
                  data. Large features split this into an actions/ folder by
                  sub-domain (no barrel — call sites import the specific file).
    api/          client.ts (typed fetchers + URL builders for the feature's
                  routes) and queries.ts (TanStack Query queryOptions
                  factories — the only place query keys are defined).
    components/   Feature UI.
    hooks/        Feature client hooks.
    lib/          Pure logic: no I/O, no React — this is what unit tests
                  import (schemas, limits, listing/move planning…).
    server/       server-only modules: storage access, service functions,
                  action middleware (e.g. sourceAccessMiddleware), I/O helpers
                  used by actions and routes.
  sources/        Source management (admin-only): zod schema, actions,
                  add/edit/remove UI, provider icon mapping
                  (components/provider-icons.ts).
  browser/        File browsing and writing: listing service, pure helpers,
                  table/grid/preview/upload components, write actions that
                  record to the audit log.
  auth/           Sign-in/sign-up forms (TanStack Form + authClient), OIDC
                  button, user menu.
  admin/          Admin area UI: users table, groups manager, per-source
                  grant editor, and the admin server actions.
  activity/       Audit log UI (admin-only page): action/source/search
                  filters and the operation → label/icon mapping.
  shares/         Share-link management and the public /s/<token> viewer:
                  the "Shared links" page (users see their own, admins all),
                  revocation and the password-unlock form. Link creation
                  lives in browser/ (share dialog); the pure logic both
                  features need (expiry, password, token, unlock cookie) sits
                  in src/lib/shares/.
src/forms/        TanStack Form infrastructure (createFormHook): reusable
                  field components (fields/), form components (SubmitButton,
                  FormAlert) and error helpers. No domain knowledge.
src/lib/dal/      Data access layer — the only place that touches Prisma.
                  sources.ts (encrypted credentials, grant-filtered
                  listSourcesFor), permissions.ts (grants), groups.ts,
                  users.ts, operations.ts (audit log). Runs server-only,
                  returns domain types, never raw Prisma records to the
                  client.
src/lib/auth/     better-auth: instance (auth.ts — plugins admin +
                  genericOAuth + nextCookies), browser client (client.ts),
                  session helpers (session.ts — getSession/requireSession/
                  requireAdmin/currentUser/currentAdmin), OIDC provider from
                  env (oidc.ts) and requireSourceAccess (access.ts), the
                  single read gate for a source.
src/lib/authz/    Pure permission logic — no I/O, unit-tested: mergeGrants,
                  resolveAccess (role + grant → capabilities), groups-claim
                  normalization.
src/lib/storage/  Shared storage infrastructure: provider registry
                  (providers.ts, pure data), region resolution, the files-sdk
                  client factory (client.ts, server-only) and the streaming
                  fallback (stream.ts — Range-aware body streaming for
                  providers without presigned URLs) — used by both features
                  and the API routes.
src/lib/shares/   Share-link logic shared by browser/ (creation) and shares/
                  (management) plus the public routes: expiry, password
                  hashing, token generation, proof-of-password unlock cookie.
src/lib/branding/ White-label branding shared by admin/ (settings form), the
                  app shell and the public logo route.
src/lib/          Shared low-level modules: prisma client, crypto, env,
                  formatting, safe-action (next-safe-action clients +
                  ActionError), apiError, path helpers, SMTP mailer (mail.ts),
                  clipboard helper (clipboard.ts).
src/components/   App shell (layout/), providers (providers/), shared widgets
                  (confirm-dialog) and shadcn/ui primitives (ui/, lint off).
src/i18n/         next-intl configuration: config.ts (pure — locales, default,
                  cookie name), request.ts (getRequestConfig: cookie, else
                  Accept-Language, else default, loads messages/<locale>.json),
                  negotiation.ts (pure Accept-Language parsing, unit-tested).
src/generated/    Prisma client output (gitignored, regenerated on install).
messages/         en.json / fr.json — one namespace per feature area (common,
                  layout, auth, account, browser, sources, admin, activity,
                  shares). English is the source of truth; both files must
                  carry the same key tree.
prisma/           Schema + versioned SQL migrations (migrations/).
```

Dependency direction: `app → features → (forms | components | lib) →
generated`. No barrel files — import files directly.

These boundaries are **enforced by Biome** (`noRestrictedImports` in
`biome.json`): no cross-feature imports, no imports from `app/`, and Prisma
(`@/lib/prisma`, `@/generated/prisma/*`) only inside `src/lib/dal/` and
`src/lib/auth/` (the better-auth instance needs the client for its adapter
and hooks). A violation is a lint error, not a review comment.

## Authorization

Two roles (`user`, `admin` — the **first account ever created becomes
admin**) and one grant table (`SourcePermission`): a grant gives its subject
(a user **or** a group, exactly one — CHECK constraint) read access to one
source; `canEdit` (upload, rename, move, new folder) and `canDelete` add to
it. Admins implicitly hold every capability and see every source. Groups can be synced from an OIDC `groups` claim: names that
exactly match an app group are assigned at sign-in (`via: "oidc"`), and only
those are removed when the claim stops listing them — admin-added memberships
(`via: "manual"`) are never touched.

Every server entry point re-validates (a layout check protects nothing else):

| Entry | Guard |
|---|---|
| `(app)` layout, `/`, `/account`, `/shares` | `requireSession` (+ `listSourcesFor` for the sidebar) |
| `/source/[id]` | `requireSourceAccess` → `notFound()` |
| `/activity`, `/admin/*`, source actions | admin only (`requireAdmin` / `currentAdmin()`) |
| admin actions | `adminActionClient` (src/lib/safe-action.ts) |
| browser write actions | `sourceAccessMiddleware` (session + grant edit/delete) |
| `copyEntriesToSource` | `requireSourceAccess` on both ends + `canEdit` on the destination |
| `createShareLink` | session + `requireSourceAccess` + instance-wide public-sharing setting |
| Routes `details/download/folders/preview/search/text/thumbnail/zip` | `requireSourceAccess` → 404 |
| Route `upload` (POST) | `requireSourceAccess` + `canEdit` → 403 |
| `/s/[token]`, `api/s/[token]/download` | share token + expiry (+ unlock cookie when password-protected) → 404 |
| `api/branding/logo` | public by design (login page, share viewer) |
| `/api/health`, `/api/auth/*`, `/sign-in`, `/sign-up` | public |
| `proxy.ts` | optimistic cookie check only — **never** a security boundary |

`requireSourceAccess(sourceId)` (`src/lib/auth/access.ts`) is the single read
gate: session + source + merged grant, resolved to capabilities. It answers
`null` uniformly for "no session", "no such source" and "no grant", so
callers return 404/notFound() and never reveal that a source exists.

## Conventions

- **Server actions all use next-safe-action** (`src/lib/safe-action.ts`):
  `authActionClient`/`adminActionClient` gate the caller, `actionClient` +
  `sourceAccessMiddleware` gates browser writes. Inputs are declared with
  `.inputSchema()` (the same zod schema the form uses); user-visible errors
  are thrown as `ActionError` (already translated), everything else surfaces
  through `metadata.failureKey`. Each action passes metadata `{ actionName,
  revalidate?, failureKey? }`. Actions stay thin and return only what the UI
  needs (never a raw DB record); callers read `result.data` /
  `result.serverError` / `result.validationErrors`. Auth/permission checks
  live in the client/middleware, not in the page.
- **Route handlers all fail with `apiError(status, message)`**
  (`{ error: string }` JSON) — the fetchers in `api/client.ts` rely on it.
- **Query keys live only in `api/queries.ts`** as `queryOptions` factories
  (TanStack Query v5). Components spread the factory
  (`useQuery({ ...browserQueries.textPreview(...), enabled })`) or pass it to
  `queryClient.fetchQuery`.
- **Every form uses the `src/forms/` kit** (`useAppForm` + field components),
  validated with the same zod schema as the server action.
- **Validation has one source of truth per input** (zod, in
  `features/*/lib/schema(s).ts`): the form validates it client-side, the
  action re-parses it server-side. Never hand-validate in two places.
- **Every UI string goes through next-intl** (`useTranslations` in client
  components, `getTranslations` in RSCs, `generateMetadata`, server actions
  and route handlers). Pure modules (`features/*/lib/`, `src/lib/`) never
  import next-intl — they expose message **keys** (e.g.
  `features/activity/lib/operation-labels.ts`) and the component resolves
  them at render with `t(key)`. Server-action errors are translated
  server-side before they surface (thrown as `ActionError`, or resolved from
  `metadata.failureKey` in `handleServerError`). Locale resolution is a
  cookie, else `Accept-Language`, else English — no `[locale]` route segment,
  no middleware. Out of scope: zod messages, emails, server logs.

## Key decisions

- **Providers are declarative**: `src/lib/storage/providers.ts`
  describes label, endpoint placeholder, field vocabulary, signing region and
  addressing style — kept free of UI so server-only modules can import it;
  the icon mapping lives in
  `src/features/sources/components/provider-icons.ts`. An S3-compatible
  provider is one registry entry; a provider with its own protocol (Azure)
  adds a case in `src/lib/storage/client.ts`.
- **Secrets are encrypted at rest** (AES-256-GCM, `src/lib/crypto.ts`) with
  `ENCRYPTION_KEY`; encryption/decryption only happens inside
  `src/lib/dal/sources.ts`. Only the DAL and `src/lib/env.ts` read secrets.
- **PostgreSQL via Prisma, schema owned by migrations**: the runtime client
  connects through the `@prisma/adapter-pg` driver adapter
  (`src/lib/prisma.ts`, lazy singleton on `globalThis`). Schema changes are
  real, versioned SQL migrations in `prisma/migrations/`, applied with
  `prisma migrate deploy` on every container boot. There is **no**
  hand-written bootstrap DDL. No repository layer on top of Prisma either —
  the DAL is named functions per model; PrismaClient is already a typed
  repository.
- **Writes are grant-gated server-side**: every write action re-checks the
  session and the grant's capabilities via `sourceAccessMiddleware` — hiding a
  control is only cosmetic. Renaming and moving count as edits (the content
  survives under a new key, even though the implementation is copy +
  delete).
- **Auth is better-auth, sessions in the database**: revocable sessions,
  httpOnly cookies, `nextCookies()` last in the plugin list so server actions
  can set cookies. The first account becomes admin and sign-up then closes
  (re-openable via the `allowPublicSignUp` setting, Admin → Settings) — both
  enforced in `databaseHooks.user.create.before`; `role` is not
  client-assignable (admin plugin `input: false` + the hook forces it). The optional OIDC
  provider is pure configuration (`OIDC_*` env, genericOAuth plugin) — no
  code change to swap IdPs. Write operations are audited (`operations`
  table), attributed to the session user (email + userId, denormalized so
  history survives account deletion).
- **Navigation state lives in the URL** (`?prefix=`, `?cursor=`, `?q=`,
  `?sort=` via nuqs) and the view preference in a cookie read server-side —
  no client data fetching, no flash.
- **Reads are RSC or GET routes, never server actions**: server actions run
  as serial POSTs and can't be cached — they're reserved for mutations.
  Preview media point their `src` at `app/api/sources/[id]/preview` (a
  redirect to a presigned URL — zero client fetch); details, text preview,
  share links and source config are GET routes returning JSON.
- **Presigned URLs are capability-gated**: providers with no signing
  primitive (SFTP, FTP, WebDAV — `files.capabilities.signedUrl.supported`)
  make download/preview/thumbnail — and share-link downloads — stream the
  body through the app instead (`src/lib/storage/stream.ts`, Range-aware,
  inline HTML/SVG forced to attachment). Share links themselves are not
  capability-gated: any user with read access can create one (the `canShare`
  prop only reflects the instance-wide public-sharing setting, re-checked in
  `createShareLink`). After a
  mutation the browser calls `router.refresh()` (the listing is RSC-rendered);
  source mutations revalidate with `revalidatePath` (the sidebar lives in the
  layout).

## Gotchas

- Never import a value from a `"use client"` module into a server component:
  it becomes an opaque client reference and fails silently. Shared constants
  live in plain modules (see `features/browser/lib/view.ts`).
- `cookies()`, `params`, `searchParams` are async in Next 16 — always `await`.
- Route handlers and server actions are their own entry points; they don't
  inherit anything from layouts.
- Pure logic that deserves tests lives in `features/*/lib/` without
  `server-only` so Vitest can import it; `server-only` is stubbed in
  `vitest.config.ts`.

## Testing

Unit tests (Vitest) cover the pure, high-risk modules: crypto roundtrip,
region extraction, input schemas, listing partition, move planning,
formatting, path helpers. Tests are colocated with the module they cover.
Run `pnpm test`. UI is verified manually (`pnpm dev`).

## How do I…

- **Add an S3-compatible provider?** One entry in
  `src/lib/storage/providers.ts` + its icon in
  `features/sources/components/provider-icons.ts`.
- **Add a server action?** In the feature's `actions.ts` (or the matching
  file under `actions/` when the feature splits them): pick a client from
  `src/lib/safe-action.ts` (`authActionClient`/`adminActionClient`, or
  `actionClient.use(sourceAccessMiddleware(...))` for browser writes), declare
  metadata `{ actionName, … }` and an `.inputSchema()` (schema in `lib/`),
  delegate to a `server/` module or the DAL, and return only what the UI
  needs. Throw `ActionError` for user-visible failures.
- **Guard a new page or route?** Pages: `requireSession()` /
  `requireAdmin()` (`src/lib/auth/session.ts`); anything source-scoped:
  `requireSourceAccess(id)` (`src/lib/auth/access.ts`) and answer 404 on
  null. Never rely on the proxy or a layout.
- **Add an on-demand read?** GET route under `app/api/sources/[id]/…`
  (errors via `apiError`), typed fetcher in the feature's `api/client.ts`,
  `queryOptions` entry in `api/queries.ts`.
- **Add a reusable form field?** Component in `src/forms/fields/` using
  `useFieldContext`, then register it in `src/forms/form.ts`.
- **Add a table/grid column?** `features/browser/components/file-table.tsx` /
  `file-grid.tsx`; the data shape comes from `features/browser/lib/listing.ts`.
- **Change the DB schema?** Edit `prisma/schema.prisma`, then
  `pnpm db:migrate` (`prisma migrate dev`) to generate a migration and
  regenerate the client (into `src/generated/`). Commit the new folder under
  `prisma/migrations/`. Production applies it automatically on the next
  deploy.
- **Add a translated string?** Add the key to **both**
  `messages/en.json` and `messages/fr.json`, under the namespace matching the
  feature (`common`, `layout`, `auth`, `account`, `browser`, `sources`,
  `admin`, `activity`, `shares`). Client component: `useTranslations(ns)` +
  `t("key")`; RSC/`generateMetadata`/server action/route handler:
  `await getTranslations(ns)`. ICU for interpolation/plurals (`{count,
  plural, one {# item} other {# items}}`), never string concatenation. A
  pure `lib/` module exposes the key, not the resolved text.
- **Audit a new write action?** Call `recordOperation` from
  `src/lib/dal/operations.ts` after the write succeeds, and add a label/icon
  in `features/activity/lib/operation-labels.ts`.
- **Deploy?** `Dockerfile` (standalone + Prisma CLI, non-root, `/api/health`
  healthcheck) + `docker-compose.yml` (Dokploy-ready; bring your own
  PostgreSQL via `DATABASE_URL`). Boot fails fast on a malformed
  `ENCRYPTION_KEY` or a missing `DATABASE_URL` (`src/instrumentation.ts`);
  the entrypoint runs pending migrations before the server starts.
