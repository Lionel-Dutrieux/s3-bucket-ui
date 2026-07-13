# Architecture

Bucket UI is a single Next.js 16 app (App Router, server components, server
actions). Pages read data on the server (RSC), mutations go through server
actions. Server actions are **never** used for reads: the few on-demand reads
a dialog needs after render (preview URLs, file details, text preview, source
config) come from GET route handlers under `app/api/sources/[id]/`, consumed
with TanStack Query through the typed fetchers in each feature's
`api/client.ts`.

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
    actions.ts    'use server' — thin server actions: zod-parse input,
                  delegate, return ActionResult.
    api/          client.ts (typed fetchers + URL builders for the feature's
                  routes) and queries.ts (TanStack Query queryOptions
                  factories — the only place query keys are defined).
    components/   Feature UI.
    hooks/        Feature client hooks.
    lib/          Pure logic: no I/O, no React — this is what unit tests
                  import (schemas, limits, listing/move planning…).
    server/       server-only modules: storage access, service functions,
                  write guards, I/O helpers used by actions and routes.
  sources/        Source management: provider registry (lib/providers.ts,
                  pure — icons live in components/provider-icons.ts), storage
                  client factory (server/storage.ts), zod schema, actions,
                  add/edit/remove UI. Per-source write permissions
                  (allowUpload, allowDelete).
  browser/        File browsing and writing: listing service, pure helpers,
                  table/grid/preview/upload components, write actions that
                  record to the audit log.
src/forms/        TanStack Form infrastructure (createFormHook): reusable
                  field components (fields/), form components (SubmitButton,
                  FormAlert) and error helpers. No domain knowledge.
src/lib/dal/      Data access layer — the only place that touches Prisma.
                  sources.ts (encrypted credentials), operations.ts (audit
                  log). Runs server-only, returns domain types, never raw
                  Prisma records to the client.
src/lib/          Shared low-level modules: prisma client, crypto, env,
                  formatting, ActionResult, apiError, path helpers.
src/components/   App shell (layout/), providers (providers/), shared widgets
                  (confirm-dialog) and shadcn/ui primitives (ui/, lint off).
src/generated/    Prisma client output (gitignored, regenerated on install).
prisma/           Schema + versioned SQL migrations (migrations/).
```

Dependency direction: `app → features → (forms | components | lib) →
generated`. No barrel files — import files directly.

## Conventions

- **Server actions all return `ActionResult`** (`src/lib/action-result.ts`),
  a discriminated union — callers narrow on `result.ok`. Actions zod-parse
  their input first, stay thin, and return only what the UI needs (never a
  raw DB record). Auth/permission checks happen inside the action path
  (`withWriteAccess`), not in the page.
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

## Key decisions

- **Providers are declarative**: `features/sources/lib/providers.ts`
  describes label, endpoint placeholder, field vocabulary, signing region and
  addressing style — kept free of UI so `server/storage.ts` can import it;
  the icon mapping lives in `components/provider-icons.ts`. An S3-compatible
  provider is one registry entry; a provider with its own protocol (Azure)
  adds a case in `features/sources/server/storage.ts`.
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
- **Writes are opt-in and gated server-side**: sources are read-only unless
  `allowUpload` / `allowDelete` are set. Every write action re-checks the
  permission on the server via `withWriteAccess` — hiding a control is only
  cosmetic. Renaming (move = copy + delete) needs both.
- **No built-in auth**: the app is deployed behind an authenticating reverse
  proxy. Do not add auth logic without revisiting this decision. Write
  operations are audited (`operations` table) and attributed to the proxy's
  forwarded identity when present — that's the accountability layer, not app
  auth.
- **Navigation state lives in the URL** (`?prefix=`, `?cursor=`, `?q=`,
  `?sort=` via nuqs) and the view preference in a cookie read server-side —
  no client data fetching, no flash.
- **Reads are RSC or GET routes, never server actions**: server actions run
  as serial POSTs and can't be cached — they're reserved for mutations.
  Preview media point their `src` at `app/api/sources/[id]/preview` (a
  redirect to a presigned URL — zero client fetch); details, text preview,
  share links and source config are GET routes returning JSON. After a
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
  `features/sources/lib/providers.ts` + its icon in
  `features/sources/components/provider-icons.ts`.
- **Add a server action?** In the feature's `actions.ts`: zod-parse the
  input (schema in `lib/`), delegate to a `server/` module or the DAL, return
  `ActionResult`. Wrap browser writes in `withWriteAccess`.
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
- **Audit a new write action?** Call `recordOperation` from
  `src/lib/dal/operations.ts` after the write succeeds, and add a label/icon
  in `features/browser/lib/operation-labels.ts`.
- **Deploy?** `Dockerfile` (standalone + Prisma CLI, non-root, `/api/health`
  healthcheck) + `docker-compose.yml` (Dokploy-ready; bring your own
  PostgreSQL via `DATABASE_URL`). Boot fails fast on a malformed
  `ENCRYPTION_KEY` or a missing `DATABASE_URL` (`src/instrumentation.ts`);
  the entrypoint runs pending migrations before the server starts.
