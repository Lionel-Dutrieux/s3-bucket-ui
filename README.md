<div align="center">

<img src="public/logo.svg" width="110" alt="Bucket UI logo" />

# Bucket UI

**A self-hosted file manager for all your storage — S3, R2, Azure, SFTP and more, behind one Drive-style UI.**

[![CI](https://github.com/Lionel-Dutrieux/s3-bucket-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/Lionel-Dutrieux/s3-bucket-ui/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Lionel-Dutrieux/s3-bucket-ui?color=f59e0b)](https://github.com/Lionel-Dutrieux/s3-bucket-ui/releases)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-2496ED?logo=docker&logoColor=white)](https://github.com/Lionel-Dutrieux/s3-bucket-ui/pkgs/container/s3-bucket-ui)
[![License](https://img.shields.io/github/license/Lionel-Dutrieux/s3-bucket-ui?color=blue)](LICENSE)

[Quick start](#-quick-start) · [Features](#-features) · [Configuration](#-configuration) · [Providers](docs/providers.md) · [Contributing](CONTRIBUTING.md)

</div>

<!--
  Hero screenshot — capture once UI is stable. Shot list:
  - List view of a source with breadcrumbs
  - Grid view with image thumbnails
  - Sidebar showing several provider logos (S3, R2, Azure, SFTP, ...)
  Save as docs/assets/hero.png, then uncomment:

  <p align="center">
    <img src="docs/assets/hero.png" alt="Bucket UI — list and grid views with breadcrumbs and provider sidebar" width="900" />
  </p>
-->

## Why Bucket UI?

Giving someone access to a bucket usually means handing them the S3
credentials — one console per provider, built for engineers, not for the
person who just needs one file. Bucket UI puts all the storage you own (object
stores and protocols) behind one interface and **grants access to a bucket
without ever handing out its credentials.** Per-user and per-group
permissions are enforced server-side, and a source stays invisible until an
admin grants it — with native OIDC SSO, grants, an audit trail and
white-labeling, it's enterprise-grade access control, **free and
self-hosted.**

> "I built Bucket UI to manage the S3 buckets behind my Dokploy apps —
> pulling backups, curating an app's media, handing a single document to
> someone who had no bucket access."

### How it works

The database only ever holds authentication, permissions and source
definitions — never your files. Every browse, upload, download and preview
goes straight to the storage itself through
[files-sdk](https://files-sdk.dev); **Bucket UI never copies or stores your
files.** No lock-in, no data duplication.

## ✨ Features

<!--
  Demo GIF — capture once UI is stable. Shot list:
  - Browse a source, toggle list -> grid view
  - Open a preview (image or PDF), navigate with </>
  - Search across a source, open a result straight into preview
  - Upload a file/folder with the progress tray
  - Create a share link with expiry/password, then revoke it
  Save as docs/assets/demo.gif, then uncomment:

  ![Bucket UI demo](docs/assets/demo.gif)
-->

- **Familiar browsing** — list and grid views with image thumbnails, breadcrumbs,
  drag & drop, right-click menus, multi-select with shift-click, keyboard
  shortcuts, a `Ctrl+K` palette, and URL-shareable filters and sorting.
- **Rich previews** — images, PDFs, video, audio and text/code/Markdown open
  in place, with ←/→ browsing between files.
- **Search everywhere** — source-wide search across every folder; results
  open straight into their preview.
- **Real file management** *(per-grant)* — upload files or whole folders with
  a progress tray, create folders, rename inline, move, duplicate and delete;
  copy selections **across sources and across providers** (R2 → S3,
  S3 → Azure, …).
- **Sharing** — public share links with optional expiry and password,
  download counting and one-click revocation; any folder downloads as a
  streamed ZIP.
- **Authentication built in** — email/password plus optional OIDC SSO
  (Pocket ID, Authentik, Keycloak, …) configured via environment variables;
  the first account becomes the admin, then sign-up closes automatically.
- **Fine-grained access control** — users, groups and per-source read / edit /
  delete grants; OIDC group claims sync memberships automatically at sign-in.
- **Audit trail** — every write across all sources is logged and attributed,
  on the admin-only Activity page.

### Supported storage

**Object stores:** Cloudflare R2 · Amazon S3 · Google Cloud Storage ·
Azure Blob Storage · MinIO · DigitalOcean Spaces · Backblaze B2 · Hetzner ·
Wasabi · Scaleway · OVHcloud · Storj · any S3-compatible service (Garage,
SeaweedFS, Ceph RGW, …)

**Protocols:** SFTP · FTP / FTPS · WebDAV (Nextcloud, ownCloud, NAS boxes) —
same UI, downloads and previews stream through the app.

→ Endpoints and credentials per provider: **[docs/providers.md](docs/providers.md)**

## 🚀 Quick start

### Docker Compose (recommended)

The demo stack bundles the app and its PostgreSQL — nothing else to provide:

```bash
git clone https://github.com/Lionel-Dutrieux/s3-bucket-ui.git && cd s3-bucket-ui

ENCRYPTION_KEY=$(openssl rand -hex 32) \
BETTER_AUTH_SECRET=$(openssl rand -base64 32) \
docker compose -f docker-compose.demo.yml up -d
```

Open http://localhost:3000 and **sign up — the first account becomes the
admin** (sign-up closes right after). Then add a source in Admin → Sources
and grant access. Keep `ENCRYPTION_KEY` safe: source credentials are
encrypted with it and cannot be recovered without it.

For production, bring your own PostgreSQL with the main `docker-compose.yml`
([Dokploy](https://dokploy.com)-ready — external `dokploy-network`, domain
and secrets configured in the UI) and read
**[docs/operations.md](docs/operations.md)** (HTTPS reverse proxy,
backup/restore, upgrades). The image is a multi-stage standalone build
(non-root, healthcheck on `/api/health`, `linux/amd64` + `linux/arm64`) and
applies pending migrations on boot.

> [!WARNING]
> The first-account rule also applies to OIDC: on a fresh instance, whoever
> signs in first claims the admin role. Create the admin account before
> exposing the instance to your users.

### Images

| Tag | Channel |
|---|---|
| `latest`, `1.2.3`, `1.2`, `1` | **Stable** — cut by the Release workflow |
| `canary`, `sha-xxxxxxx` | **Canary** — every commit on `master` |

```bash
docker pull ghcr.io/lionel-dutrieux/s3-bucket-ui:latest
```

### Local development

```bash
docker run -d --name bucket-ui-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bucket_ui \
  -p 5432:5432 postgres:17-alpine

pnpm install
cp .env.example .env    # fill in DATABASE_URL, ENCRYPTION_KEY, BETTER_AUTH_SECRET
pnpm db:migrate
pnpm dev
```

## 🔧 Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://postgres:postgres@localhost:5432/bucket_ui`. |
| `ENCRYPTION_KEY` | Encrypts stored bucket credentials — `openssl rand -hex 32`. Changing it makes saved sources unreadable (delete and re-add them). |
| `BETTER_AUTH_SECRET` | Signs sessions and tokens (min 32 chars) — `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | Public URL of the app, scheme included (`http://localhost:3000` in dev). Cookie security and OAuth callbacks derive from it. |
| `OIDC_DISCOVERY_URL` | *(optional)* OIDC discovery document of your identity provider. Set together with the two below to enable SSO. |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | *(optional)* OAuth client registered with your IdP. Callback URL: `<BETTER_AUTH_URL>/api/auth/oauth2/callback/oidc`. |
| `OIDC_PROVIDER_LABEL` | *(optional)* Button label on the sign-in page (default `SSO`). |
| `OIDC_SCOPES` | *(optional)* Requested scopes (default `openid profile email groups`). |
| `OIDC_GROUPS_CLAIM` | *(optional)* Claim carrying group names (default `groups`). |
| `SMTP_HOST` / `SMTP_FROM` | *(optional, set together)* SMTP relay and sender — enables "Forgot password?" reset emails. |
| `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` | *(optional)* Relay port (default 587), implicit TLS, and credentials if the relay requires auth. |
| `LOCAL_FS_ROOTS` | *(optional)* Comma-separated allowlist of directories that "Local folder" sources may expose (e.g. volumes mounted into the container, such as `/data`). Unset = the provider is hidden from the admin UI and rejected server-side. Every source root must be one of these directories or live under one. |

<details>
<summary><b>Example: OIDC with Pocket ID</b></summary>

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

### Access model

Accounts start with no access until an admin grants them sources
(Admin → Sources), directly or through a group (Admin → Groups). A grant row
gives **read**; switches add **edit** (upload, rename, move, new folder) and
**delete**. With OIDC enabled, IdP groups matching an app group name are
assigned automatically at sign-in.

> [!NOTE]
> On an object store, renaming and moving are copy + delete of the original
> key. A user with edit (and no delete) can therefore relocate objects —
> existing links to the old keys stop resolving. Hand out edit accordingly.

## 🔐 Security model

Every server entry point (page, server action, API route) re-validates the
session and the grant — non-admins only ever see sources they were granted,
and a source they can't read answers **404**, not 403. Bucket credentials are
encrypted at rest (AES-256-GCM) and never sent to the browser. Credential
endpoints (sign-in, sign-up, password reset) are rate-limited in production.

## 🧱 Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 +
shadcn/ui · TanStack Query / Table / Form · Prisma 7 + PostgreSQL ·
[better-auth](https://better-auth.com) ·
[files-sdk](https://files-sdk.dev) · Biome · Vitest

Architecture, layers and the "how do I…" guide live in
**[ARCHITECTURE.md](ARCHITECTURE.md)**.

## 🩺 Production notes

- **[docs/operations.md](docs/operations.md)** — HTTPS reverse proxy
  examples (Caddy/Traefik/nginx), backup & restore, upgrade path.
- `GET /api/health` returns `200 {"status":"ok"}` when the app and its
  database respond, `503` otherwise.
- Bare Node.js instead of Docker: `pnpm build && pnpm db:deploy && pnpm start`.
- Releases are one click: Actions → **Release** → pick patch/minor/major —
  bumps `package.json`, tags, publishes the GitHub Release and ships the
  `latest` + semver images.

## 🤝 Contributing

Contributions are welcome! Read **[CONTRIBUTING.md](CONTRIBUTING.md)** for the
workflow — `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must pass
(CI runs the same, plus an integration job against a real MinIO container).
This project follows the
[Contributor Covenant](CODE_OF_CONDUCT.md) code of conduct.

## 📄 License

[MIT](LICENSE) © Lionel Dutrieux
