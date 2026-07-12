# Basin

A read-only file browser for your storage buckets (Cloudflare R2, Azure Blob
Storage), with a Google-Drive-style UI. Add as many sources as you want, browse
folders, download files via presigned URLs.

> **Authentication is not built in.** Deploy Basin behind an authenticating
> reverse proxy (nginx `auth_basic`, Traefik `basicAuth` middleware, Authelia,
> …). Anyone who can reach the app can browse every source.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- Tailwind CSS v4 + shadcn/ui, TanStack Form
- [files-sdk](https://files-sdk.dev) (S3 + Azure adapters) for bucket access
- Prisma 7 + SQLite via better-sqlite3 (embedded DB at `data/app.db`)
- Bucket secrets encrypted at rest (AES-256-GCM)

## Architecture

```
app/          routes only (thin pages, layouts, route handlers)
features/     feature modules: sources/, browser/ (actions + components)
forms/        TanStack Form infrastructure: reusable fields, validators
lib/dal/      data access layer (Prisma queries)
lib/          shared: prisma client, crypto, formatting
prisma/       schema (client generated into lib/generated/, gitignored)
```

After `pnpm install`, the Prisma client is generated automatically (postinstall).
Schema changes: edit `prisma/schema.prisma` then `pnpm db:push`.

## Setup

```bash
pnpm install
cp .env.example .env   # then fill it in
pnpm dev
```

`.env` variables:

| Variable | Purpose |
|---|---|
| `ENCRYPTION_KEY` | Encrypts stored bucket credentials — `openssl rand -hex 32`. Changing it makes saved sources unreadable (delete and re-add them). |

## Adding a source

- **Cloudflare R2**: create an R2 API token (**Object Read only**, scoped to the
  bucket). Cloudflare shows an S3 endpoint
  (`https://<account-id>.r2.cloudflarestorage.com`), an access key ID and a
  secret access key.
- **Azure Blob Storage**: endpoint `https://<account>.blob.core.windows.net`,
  container name, storage account name and account key.

Use **Test connection** to check the credentials; the connection is verified
again when the source is saved. Providers live in
`features/sources/providers.ts` — an S3-compatible provider is one registry
entry; a provider with its own protocol also needs a case in
`features/sources/storage.ts`.

## Production

```bash
pnpm build
pnpm start
```

The SQLite database lives in `data/` (gitignored) — persist that directory across
deploys, and put the app behind your reverse proxy's authentication.
