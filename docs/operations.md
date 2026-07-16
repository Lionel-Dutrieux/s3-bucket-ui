# Operations guide

Running Bucket UI in production: HTTPS, backups, upgrades.

## Reverse proxy (HTTPS)

Bucket UI listens on plain HTTP (port 3000) and expects a reverse proxy to
terminate TLS. Set `BETTER_AUTH_URL` to the **public https URL** — the auth
cookies are marked `Secure` in production and sign-in breaks over plain HTTP
on a non-localhost host.

Uploads pass through the proxy: raise its body-size limit to at least the
5 GiB the app accepts (or lower the ceiling at the proxy and let it be the
effective limit).

### Caddy

```caddy
buckets.example.com {
    reverse_proxy bucket-ui:3000
    request_body {
        max_size 5GB
    }
}
```

### Traefik (labels on the service)

```yaml
labels:
  - traefik.enable=true
  - traefik.http.routers.bucket-ui.rule=Host(`buckets.example.com`)
  - traefik.http.routers.bucket-ui.entrypoints=websecure
  - traefik.http.routers.bucket-ui.tls.certresolver=letsencrypt
  - traefik.http.services.bucket-ui.loadbalancer.server.port=3000
```

### nginx

```nginx
server {
    listen 443 ssl;
    server_name buckets.example.com;
    # ssl_certificate / ssl_certificate_key ...

    client_max_body_size 5g;

    location / {
        proxy_pass http://bucket-ui:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # Streamed downloads/ZIPs: don't buffer whole bodies on disk.
        proxy_buffering off;
    }
}
```

## Backup & restore

Two things hold all the state; the buckets themselves are never written to
outside the operations you perform in the UI.

1. **The PostgreSQL database** — users, sessions, sources, grants, share
   links, audit log:

   ```bash
   # Backup
   pg_dump "$DATABASE_URL" --format=custom --file=bucket-ui.dump
   # Restore (into an empty database)
   pg_restore --dbname="$DATABASE_URL" --no-owner bucket-ui.dump
   ```

2. **`ENCRYPTION_KEY`** — source credentials are encrypted with it
   (AES-256-GCM). **A database backup is useless without the key**: keep the
   key in your secret store alongside the dump. If the key is lost, every
   source has to be re-entered by hand; there is no recovery.

`BETTER_AUTH_SECRET` signs sessions — losing it only signs everyone out.

## Upgrades

The container applies pending Prisma migrations on every boot, so upgrading
is:

```bash
docker compose pull && docker compose up -d
```

- **Pin a major** (`image: …:1`) if you want to opt into majors manually;
  `latest` follows every stable release, `canary` every master commit.
- **Back up the database before upgrading** — migrations are forward-only;
  rolling back the image after a migration ran may need the dump.
- Release notes: [GitHub Releases](https://github.com/Lionel-Dutrieux/s3-bucket-ui/releases).

## Security notes

- Credential endpoints (sign-in, sign-up, password reset/change) are
  rate-limited in production (better-auth built-in limiter, in-memory
  counters). If you run multiple replicas, put a shared limiter in front or
  at the proxy — counters are per-process.
- `/api/health` is unauthenticated by design (container healthcheck); it
  reveals nothing but liveness.
- Report vulnerabilities privately — see [SECURITY.md](../SECURITY.md).
