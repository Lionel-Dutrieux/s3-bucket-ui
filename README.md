# Bucket UI

[![CI](https://github.com/Lionel-Dutrieux/s3-bucket-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/Lionel-Dutrieux/s3-bucket-ui/actions/workflows/ci.yml)

A file manager for your storage buckets, with a Google-Drive-style UI. Add as
many sources as you want, browse folders, and — where a grant allows it —
upload, delete and rename. Access is per user and per group: a source is
invisible until an admin grants it, and every permission is enforced
server-side.

Features:

- **Browse** — list and grid views (with lazy image thumbnails), file-type
  filter, name filter and column sorting shareable via the URL (`?q=`,
  `?sort=`), `Ctrl+K` command palette, dark mode.
- **Preview** — images, PDFs (sandboxed), video, audio, and plain
  text/code/Markdown (first 1 MB), without leaving the app.
- **Search & download** — source-wide search across every folder, and any
  folder downloadable as one streamed ZIP archive.
- **Share & inspect** — presigned download links (1 h), per-file details
  (Content-Type, ETag, user metadata, copyable key).
- **Write, if you're allowed to** — the edit grant unlocks uploads (button
  or drag & drop of files and whole folders, with a progress tray), folder
  creation, renaming, moving and duplicating; the delete grant unlocks
  deletions (single, multi-select, or a whole folder, with confirmation).
- **Copy across sources** — send a selection of files and folders into any
  folder of another source (edit grant required there), or let admins copy a
  source's entire contents into another one — across providers (S3 → Azure,
  R2 → S3, …), never touching the origin.
- **Built-in authentication** — email/password plus an optional generic OIDC
  provider (Pocket ID, Authentik, Keycloak…) configured entirely through
  environment variables. The very first account created becomes the admin;
  sign-up then closes automatically (admins create accounts, or re-open
  public sign-up in Admin → Settings).
- **Users, groups & per-source access** — admins manage accounts (create,
  roles, ban, remove), groups, and who can read/edit/delete on each source. At OIDC
  sign-in, the identity provider's `groups` claim is matched by name against
  app groups and memberships are synced automatically (à la Homarr).
- **Activity log** — every write across all sources, attributed to the
  signed-in user, on the admin-only Activity page. Read actions aren't
  recorded.

Supported providers: Cloudflare R2, Amazon S3, Google Cloud Storage (HMAC),
Azure Blob Storage, MinIO, DigitalOcean Spaces, Backblaze B2, Hetzner Object
Storage, Wasabi, Scaleway, OVHcloud, Storj — plus a generic S3-compatible
entry for anything else speaking the S3 API (Garage, SeaweedFS, Ceph RGW, …).
And beyond object stores: **SFTP, FTP/FTPS and WebDAV** (Nextcloud, ownCloud,
NAS boxes) sources browse with the exact same UI — downloads and previews
stream through the app since those protocols can't presign URLs.

> **Security model.** Every server entry point (page, server action, API
> route) re-validates the session and the grant — non-admins only ever see
> sources they were granted, and a source they can't read answers 404. Bucket
> credentials are encrypted at rest and never sent to the browser.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript 7 (native compiler)
- Biome (linting + formatting)
- Tailwind CSS v4 + shadcn/ui, TanStack Form + Table + Query, nuqs (URL state)
- [files-sdk](https://files-sdk.dev) (S3 + Azure adapters) for bucket access
- Prisma 7 + PostgreSQL (via the `@prisma/adapter-pg` driver adapter)
- [better-auth](https://better-auth.com) (sessions, admin plugin, generic
  OIDC) for authentication
- Bucket secrets encrypted at rest (AES-256-GCM)

## Architecture

```
src/app/          routes only (thin pages, layouts, API route handlers)
src/features/     feature modules: sources/, browser/, auth/, admin/ — each
                  split into actions.ts, api/, components/, hooks/, lib/, server/
src/forms/        TanStack Form infrastructure: reusable fields, form components
src/lib/dal/      data access layer (Prisma queries): sources, permissions,
                  groups, users, operations (audit log)
src/lib/auth/     better-auth instance, session helpers, requireSourceAccess
src/lib/authz/    pure permission resolution (unit-tested, no I/O)
src/lib/          shared: prisma client, crypto, env, formatting, ActionResult
src/components/   app shell (layout/), providers/, shared widgets, shadcn (ui/)
prisma/           schema (client generated into src/generated/, gitignored)
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
| `BETTER_AUTH_SECRET` | Signs sessions and tokens (min 32 chars) — `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | Public URL of the app, scheme included (`http://localhost:3000` in dev). Cookie security and OAuth callbacks derive from it. |
| `OIDC_DISCOVERY_URL` | *(optional)* OIDC discovery document of your identity provider, e.g. `https://id.example.com/.well-known/openid-configuration`. Set together with the two below to enable SSO. |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | *(optional)* OAuth client credentials registered with your IdP. Callback URL to register: `<BETTER_AUTH_URL>/api/auth/oauth2/callback/oidc`. |
| `OIDC_PROVIDER_LABEL` | *(optional)* Button label on the sign-in page (default `SSO`). |
| `OIDC_SCOPES` | *(optional)* Requested scopes (default `openid profile email groups`). |
| `OIDC_GROUPS_CLAIM` | *(optional)* Claim carrying group names (default `groups`). |
| `SMTP_HOST` / `SMTP_FROM` | *(optional, set together)* SMTP relay and sender — enables "Forgot password?" reset emails. |
| `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` | *(optional)* Relay port (default 587), implicit TLS, and credentials if the relay requires auth. |

Once running, **sign up — the very first account becomes the admin**, and
sign-up closes right after (create accounts from Admin → Users, or re-open
public sign-up in Admin → Settings). Accounts start with no access until an
admin grants them sources (Admin → Sources), directly or through a group
(Admin → Groups). With OIDC enabled, groups from the IdP's claim that exactly
match an app group name are assigned automatically at sign-in.

> [!WARNING]
> The first-account rule also applies to OIDC: on a fresh instance, whoever
> signs in first — including any user of a shared identity provider — claims
> the admin role. Create the admin account before exposing the instance to
> your users.

A note on the **edit** grant: renaming and moving are edits, and on an object
store both are copy + delete of the original key. A user with edit (and no
delete) can therefore relocate objects — existing links to the old keys stop
resolving, even though nothing leaves the bucket. Hand out edit accordingly.

<details>
<summary>Example: Pocket ID</summary>

In Pocket ID, create an OIDC client with callback URL
`https://buckets.example.com/api/auth/oauth2/callback/oidc`, then set:

```bash
OIDC_DISCOVERY_URL=https://id.example.com/.well-known/openid-configuration
OIDC_CLIENT_ID=<client id>
OIDC_CLIENT_SECRET=<client secret>
OIDC_PROVIDER_LABEL=Pocket ID
```

Pocket ID exposes user groups through the `groups` claim (the default) — an
app group named exactly like a Pocket ID group picks its members up
automatically at sign-in.
</details>

## Adding a source

Only admins add sources. Every source is endpoint + bucket/container + a key
pair (read-only credentials recommended — grant write scopes only if you plan
to hand out edit/delete grants on the source):

- **Cloudflare R2**: R2 API token (**Object Read only**) —
  `https://<account-id>.r2.cloudflarestorage.com`.
- **Amazon S3**: IAM access key with `s3:ListBucket` + `s3:GetObject` —
  `https://s3.<region>.amazonaws.com` (the region is read from the endpoint).
- **Google Cloud Storage**: [HMAC keys](https://cloud.google.com/storage/docs/authentication/hmackeys)
  on a service account — `https://storage.googleapis.com`.
- **Azure Blob Storage**: storage account name + account key —
  `https://<account>.blob.core.windows.net`.
- **Backblaze B2**: application key (ID + key) —
  `https://s3.<cluster>.backblazeb2.com` (the cluster is shown next to the
  bucket's endpoint in the Backblaze console).
- **Hetzner Object Storage**: S3 credentials —
  `https://<location>.your-objectstorage.com` (`fsn1`, `nbg1`, `hel1`).
- **Wasabi**: access key pair — `https://s3.<region>.wasabisys.com`.
- **Scaleway**: IAM API key — `https://s3.<region>.scw.cloud` (`fr-par`,
  `nl-ams`, `pl-waw`).
- **OVHcloud**: S3 user credentials — `https://s3.<region>.io.cloud.ovh.net`
  (High Performance) or `https://s3.<region>.cloud.ovh.net` (Standard).
- **Storj**: S3 gateway credentials — `https://gateway.storjshare.io`, or
  your self-hosted gateway URL.
- **MinIO / DigitalOcean Spaces / anything S3-compatible**: the service's S3
  endpoint and key pair (the generic *S3-compatible* entry covers Garage,
  SeaweedFS, Ceph RGW, LocalStack, …).
- **SFTP**: `sftp://host:22`, username + password; "Root path" scopes the
  source to a directory (`/` for the whole tree).
- **FTP / FTPS**: `ftps://host:21` (or `ftp://` — FTPS strongly recommended),
  username + password, root path.
- **WebDAV / Nextcloud**: the DAV base URL — for Nextcloud
  `https://cloud.example.com/remote.php/dav/files/<user>` — username +
  password (use an app password), root path.

> [!NOTE]
> Protocol sources (SFTP/FTP/WebDAV) have no presigned URLs: downloads,
> previews and thumbnails stream through the app instead of redirecting to
> the storage origin, and the **Copy link** action is unavailable. Listings
> walk the directory tree per request, so very large trees browse slower
> than an object store.

Use **Test connection** to check the credentials; the connection is verified
again when the source is saved. Providers live in
`src/lib/storage/providers.ts` — an S3-compatible provider is one
declarative registry entry (label, endpoint placeholder, signing region,
addressing style; its icon goes in
`src/features/sources/components/provider-icons.ts`); a provider with its own
protocol also needs a case in `src/lib/storage/client.ts`.

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
Authentication is built in — after the first deploy, sign up to claim the
admin account.

### Bare Node.js

```bash
pnpm build
pnpm db:deploy   # apply migrations (prisma migrate deploy)
pnpm start
```

Point `DATABASE_URL` at your PostgreSQL instance and persist that database
across deploys.

### Monitoring

`GET /api/health` returns `200 {"status":"ok"}` when the app and its database
respond, `503` otherwise.
