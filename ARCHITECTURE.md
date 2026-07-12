# Architecture

Bucket UI is a single Next.js 16 app (App Router, server components, server
actions). No API layer, no client-side data fetching: pages read data on the
server, mutations go through server actions.

## Layers

```
app/           Routes only. Pages stay thin: parse params, call a service/DAL,
               render feature components. No business logic.
features/      One folder per domain. Owns its server actions, services,
               schemas and components. Features may import from lib/ and
               forms/, never from app/ or from another feature's internals.
  sources/     Source management: provider registry, storage client factory,
               Zod schema, actions, add/remove UI.
  browser/     File browsing: listing service, pure listing helpers,
               table/grid/breadcrumb/view-toggle components.
forms/         TanStack Form infrastructure (createFormHook): reusable field
               components (fields/), form components (SubmitButton, FormAlert)
               and error helpers. No domain knowledge.
lib/dal/       Data access layer — the only place that touches Prisma.
lib/           Shared low-level modules: prisma client, crypto, formatting.
components/    App shell (sidebar) and shadcn/ui primitives (components/ui/).
prisma/        Schema. The client is generated into lib/generated/ (gitignored).
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
- **No built-in auth**: the app is deployed behind an authenticating reverse
  proxy. Do not add auth logic without revisiting this decision.
- **Navigation state lives in the URL** (`?prefix=`, `?cursor=`) and the view
  preference in a cookie read server-side — no client data fetching, no flash.

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
- **Change the DB schema?** `prisma/schema.prisma`, then `pnpm db:push`
  (run `pnpm exec prisma generate` if types changed) — and mirror the change
  as an idempotent statement in the bootstrap DDL of `lib/prisma.ts`, which is
  what creates the schema on a fresh database (first Docker boot).
- **Deploy?** `Dockerfile` (standalone, non-root, `/api/health` healthcheck)
  + `docker-compose.yml` (Dokploy-ready). Boot fails fast on a malformed
  `ENCRYPTION_KEY` (`instrumentation.ts`).
