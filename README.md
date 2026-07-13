# Bucket UI

[![CI](https://github.com/Lionel-Dutrieux/s3-bucket-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/Lionel-Dutrieux/s3-bucket-ui/actions/workflows/ci.yml)

A read-only file browser for your storage buckets, with a Google-Drive-style
UI. Add as many sources as you want, browse folders, download files via
presigned URLs.

Features:

- **Browse** — list and grid views (with lazy image thumbnails), file-type
  filter, name filter and column sorting shareable via the URL (`?q=`,
  `?sort=`), `Ctrl+K` command palette, dark mode.
- **Preview** — images, PDFs (sandboxed), video, audio, and plain
  text/code/Markdown (first 1 MB), without leaving the app.
- **Share & inspect** — presigned download links (1 h), per-file details
  (Content-Type, ETag, user metadata, copyable key).
- **Write, if you allow it** — sources are read-only by default; two per-source
  permissions optionally enable uploads (button or drag & drop of files and
  whole folders, with a progress tray, plus folder creation) and deletions
  (single, multi-select, or a whole folder, with confirmation). With both on,
  files and folders can be renamed. Every write is enforced server-side.

Supported providers: Cloudflare R2, Amazon S3, Google Cloud Storage (HMAC),
Azure Blob Storage, MinIO, DigitalOcean Spaces.

> **Authentication is not built in.** Deploy Bucket UI behind an authenticating
> reverse proxy (nginx `auth_basic`, Traefik `basicAuth` middleware, Authelia,
> …). Anyone who can reach the app can browse every source — and can upload to
> or delete from any source whose write permissions you enabled.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript 7 (native compiler)
- Biome (linting + formatting)
- Tailwind CSS v4 + shadcn/ui, TanStack Form + TanStack Table, nuqs (URL state)
- [files-sdk](https://files-sdk.dev) (S3 + Azure adapters) for bucket access
- Prisma 7 + PostgreSQL (via the `@prisma/adapter-pg` driver adapter)
- Bucket secrets encrypted at rest (AES-256-GCM)

## Architecture

```
app/          routes only (thin pages, layouts, route handlers)
features/     feature modules: sources/, browser/ (schema, actions, services, components)
forms/        TanStack Form infrastructure: reusable fields, form components
lib/dal/      data access layer (Prisma queries)
lib/          shared: prisma client, crypto, formatting
prisma/       schema (client generated into lib/generated/, gitignored)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for layers, key decisions and the
"how do I…" guide, and [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow
(`pnpm typecheck && pnpm lint && pnpm test && pnpm build` — CI runs the same,
plus an integration job that exercises the storage layer against a real MinIO
container).

After `pnpm install`, the Prisma client is generated automatically (postinstall).
Schema changes: edit `prisma/schema.prisma` then `pnpm db:migrate`.

## Setup

You need a PostgreSQL database. For local dev, the quickest option:

```bash
docker run -d --name bucket-ui-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bucket_ui \
  -p 5432:5432 postgres:17-alpine
```

```bash
pnpm install
cp .env.example .env    # then fill it in (DATABASE_URL, ENCRYPTION_KEY)
pnpm db:migrate         # apply migrations to the database
pnpm dev
```

`.env` variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://postgres:postgres@localhost:5432/bucket_ui`. |
| `ENCRYPTION_KEY` | Encrypts stored bucket credentials — `openssl rand -hex 32`. Changing it makes saved sources unreadable (delete and re-add them). |

## Adding a source

Every source is endpoint + bucket/container + a key pair (read-only
credentials recommended — grant write scopes only if you enable the source's
write permissions):

- **Cloudflare R2**: R2 API token (**Object Read only**) —
  `https://<account-id>.r2.cloudflarestorage.com`.
- **Amazon S3**: IAM access key with `s3:ListBucket` + `s3:GetObject` —
  `https://s3.<region>.amazonaws.com` (the region is read from the endpoint).
- **Google Cloud Storage**: [HMAC keys](https://cloud.google.com/storage/docs/authentication/hmackeys)
  on a service account — `https://storage.googleapis.com`.
- **Azure Blob Storage**: storage account name + account key —
  `https://<account>.blob.core.windows.net`.
- **MinIO / DigitalOcean Spaces**: the service's S3 endpoint and key pair.

Use **Test connection** to check the credentials; the connection is verified
again when the source is saved. Providers live in
`features/sources/providers.ts` — an S3-compatible provider is one declarative
registry entry (label, icon, endpoint placeholder, signing region, addressing
style); a provider with its own protocol also needs a case in
`features/sources/storage.ts`.

## Production

### Docker Compose (recommended)

`docker-compose.yml` runs the app, ready for [Dokploy](https://dokploy.com)
(external `dokploy-network`, domain and secrets configured in the UI). Bring
your own PostgreSQL — a Dokploy-managed database or any reachable instance — and
point `DATABASE_URL` at it:

```bash
ENCRYPTION_KEY=$(openssl rand -hex 32) \
DATABASE_URL=postgresql://user:password@host:5432/bucket_ui \
docker compose up --build -d
```

The image is a multi-stage standalone build (non-root, healthcheck on
`/api/health`). On boot the container applies any pending migrations
(`prisma migrate deploy`) before serving, so the schema is always up to date.
**Remember to attach an auth middleware (basicAuth) to the domain.**

### Bare Node.js

```bash
pnpm build
pnpm db:deploy   # apply migrations (prisma migrate deploy)
pnpm start
```

Point `DATABASE_URL` at your PostgreSQL instance, persist that database across
deploys, and put the app behind your reverse proxy's authentication.

### Monitoring

`GET /api/health` returns `200 {"status":"ok"}` when the app and its database
respond, `503` otherwise.
