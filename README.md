# Bucket UI

A read-only file browser for your storage buckets, with a Google-Drive-style
UI. Add as many sources as you want, browse folders, download files via
presigned URLs.

Supported providers: Cloudflare R2, Amazon S3, Google Cloud Storage (HMAC),
Azure Blob Storage, MinIO, DigitalOcean Spaces.

> **Authentication is not built in.** Deploy Bucket UI behind an authenticating
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
features/     feature modules: sources/, browser/ (schema, actions, services, components)
forms/        TanStack Form infrastructure: reusable fields, form components
lib/dal/      data access layer (Prisma queries)
lib/          shared: prisma client, crypto, formatting
prisma/       schema (client generated into lib/generated/, gitignored)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for layers, key decisions and the
"how do I…" guide, and [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow
(`pnpm typecheck && pnpm lint && pnpm test && pnpm build` — CI runs the same).

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

Every source is endpoint + bucket/container + a key pair (read-only
credentials recommended):

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

### Docker (recommended)

```bash
docker build -t bucket-ui .
docker run -d -p 3000:3000 \
  -e ENCRYPTION_KEY=$(openssl rand -hex 32) \
  -v bucket-ui-data:/app/data \
  bucket-ui
```

The image is a multi-stage standalone build (non-root, healthcheck on
`/api/health`), and the schema is bootstrapped automatically on first start —
just persist the `/app/data` volume. `docker-compose.yml` is ready for
[Dokploy](https://dokploy.com) (external `dokploy-network`, domain and
`ENCRYPTION_KEY` configured in the UI). **Remember to attach an auth
middleware (basicAuth) to the domain.**

### Bare Node.js

```bash
pnpm build
pnpm start
```

The SQLite database lives in `data/` (gitignored) — persist that directory across
deploys, and put the app behind your reverse proxy's authentication. Schema
changes in dev: `pnpm db:push`.

### Monitoring

`GET /api/health` returns `200 {"status":"ok"}` when the app and its database
respond, `503` otherwise.
