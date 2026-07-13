# Architecture

Bucket UI is a single Next.js 16 app (App Router, server components, server
actions). Pages read data on the server (RSC), mutations go through server
actions. Server actions are **never** used for reads: the few on-demand reads
a dialog needs after render (preview URLs, file details, text preview, source
config) come from GET route handlers under `app/source/[id]/`, consumed with
TanStack Query through the typed fetchers in the feature's `api.ts`.

## Layers

```
app/           Routes only. Pages stay thin: parse params, call a service/DAL,
               render feature components. No business logic.
features/      One folder per domain. Owns its server actions, services,
               schemas and components. Features may import from lib/ and
               forms/, never from app/ or from another feature's internals.
  sources/     Source management: provider registry, storage client factory,
               Zod schema, actions, add/remove UI. Per-source write
               permissions (allowUpload, allowDelete).
  browser/     File browsing and writing: listing service, pure helpers,
               table/grid/preview/upload components, write actions (upload
               route, delete, rename) that record to the audit log, and
               api.ts (client fetchers for the read routes).
forms/         TanStack Form infrastructure (createFormHook): reusable field
               components (fields/), form components (SubmitButton, FormAlert)
               and error helpers. No domain knowledge.
lib/dal/       Data access layer — the only place that touches Prisma.
               sources.ts (encrypted credentials), operations.ts (audit log).
lib/           Shared low-level modules: prisma client, crypto, formatting.
components/    App shell (sidebar) and shadcn/ui primitives (components/ui/).
prisma/        Schema + versioned SQL migrations (migrations/). The client is
               generated into lib/generated/ (gitignored).
```

Dependency direction: `app → features → (forms | lib) → lib/generated`.

## Key decisions

- **Validation has one source of truth**: `features/sources/schema.ts` (Zod).
  The add-source form validates against it on the client (TanStack Form
  standard-schema support) and the server actions re-parse raw input with it.
  Never hand-validate in two places.
- **Providers are declarative**: `features/sources/providers.ts` describes
  label, icon, endpoint placeholder, field vocabulary, signing region and
  addressing style. An S3-compatible provider is one registry entry; a
  provider with its own protocol (Azure) adds a case in
  `features/sources/storage.ts`.
- **Secrets are encrypted at rest** (AES-256-GCM, `lib/crypto.ts`) with
  `ENCRYPTION_KEY`; encryption/decryption only happens inside `lib/dal/sources.ts`.
- **PostgreSQL via Prisma, schema owned by migrations**: the runtime client
  connects through the `@prisma/adapter-pg` driver adapter (`lib/prisma.ts`,
  reads `DATABASE_URL`). Schema changes are real, versioned SQL migrations in
  `prisma/migrations/`, applied with `prisma migrate deploy` — on every
  container boot via the Docker entrypoint. There is **no** hand-written
  bootstrap DDL to keep in sync with the schema.
- **Writes are opt-in and gated server-side**: sources are read-only unless
  `allowUpload` / `allowDelete` are set. Every write action re-checks the
  permission on the server — hiding a control is only cosmetic. Renaming
  (move = copy + delete) needs both.
- **No built-in auth**: the app is deployed behind an authenticating reverse
  proxy. Do not add auth logic without revisiting this decision. Write
  operations are audited (`operations` table) and attributed to the proxy's
  forwarded identity when present — that's the accountability layer, not app
  auth.
- **Navigation state lives in the URL** (`?prefix=`, `?cursor=`) and the view
  preference in a cookie read server-side — no client data fetching, no flash.
- **Reads are RSC or GET routes, never server actions**: server actions run as
  serial POSTs and can't be cached — they're reserved for mutations. Preview
  media point their `src` at `app/source/[id]/preview` (a redirect to a
  presigned URL — zero client fetch); details, text preview, share links and
  source config are GET routes returning JSON, wrapped by typed fetchers in
  `features/*/api.ts` and consumed with TanStack Query (`useQuery` in dialogs,
  `queryClient.fetchQuery` for on-click reads). Fetchers throw on failure so
  query error states carry the route's message.

## Gotchas

- Never import a value from a `"use client"` module into a server component:
  it becomes an opaque client reference and fails silently. Shared constants
  live in plain modules (see `features/browser/view.ts`).
- `cookies()`, `params`, `searchParams` are async in Next 16 — always `await`.
- Route handlers and server actions are their own entry points; they don't
  inherit anything from layouts.
- Pure logic that deserves tests lives in dedicated modules without
  `server-only` (`features/browser/listing.ts`, `features/sources/region.ts`)
  so Vitest can import them; `server-only` is stubbed in `vitest.config.ts`.

## Testing

Unit tests (Vitest) cover the pure, high-risk modules: crypto roundtrip,
region extraction, input schema, listing partition, formatting. Run
`pnpm test`. UI is verified manually (`pnpm dev`).

## How do I…

- **Add an S3-compatible provider?** One entry in
  `features/sources/providers.ts`.
- **Add a reusable form field?** Component in `forms/fields/` using
  `useFieldContext`, then register it in `forms/form.ts`.
- **Add a table/grid column?** `features/browser/components/file-table.tsx` /
  `file-grid.tsx`; the data shape comes from `features/browser/listing.ts`.
- **Change the DB schema?** Edit `prisma/schema.prisma`, then
  `pnpm db:migrate` (`prisma migrate dev`) to generate a migration and
  regenerate the client. Commit the new folder under `prisma/migrations/`.
  Production applies it automatically on the next deploy (`prisma migrate
  deploy` in the entrypoint) — nothing to mirror by hand.
- **Audit a new write action?** Call `recordOperation` from
  `lib/dal/operations.ts` after the write succeeds, and add a label/icon in
  `features/browser/operation-labels.ts`.
- **Deploy?** `Dockerfile` (standalone + Prisma CLI, non-root, `/api/health`
  healthcheck) + `docker-compose.yml` (Dokploy-ready; bring your own PostgreSQL
  via `DATABASE_URL`). Boot fails fast on a malformed `ENCRYPTION_KEY` or a
  missing `DATABASE_URL` (`instrumentation.ts`); the entrypoint runs pending
  migrations before the server starts.
