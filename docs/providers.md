# Provider setup

Only admins add sources (Admin → Sources). Every source is an endpoint + a
bucket/container + a key pair. Read-only credentials are recommended — grant
write scopes only if you plan to hand out edit/delete grants on the source.

Use **Test connection** to check the credentials; the connection is verified
again when the source is saved.

## Object stores

| Provider | Credentials | Endpoint |
|---|---|---|
| **Cloudflare R2** | R2 API token (**Object Read only**) | `https://<account-id>.r2.cloudflarestorage.com` |
| **Amazon S3** | IAM access key with `s3:ListBucket` + `s3:GetObject` | `https://s3.<region>.amazonaws.com` (the region is read from the endpoint) |
| **Google Cloud Storage** | [HMAC keys](https://cloud.google.com/storage/docs/authentication/hmackeys) on a service account | `https://storage.googleapis.com` |
| **Azure Blob Storage** | Storage account name + account key | `https://<account>.blob.core.windows.net` |
| **Backblaze B2** | Application key (ID + key) | `https://s3.<cluster>.backblazeb2.com` (cluster shown next to the bucket's endpoint in the console) |
| **Hetzner Object Storage** | S3 credentials | `https://<location>.your-objectstorage.com` (`fsn1`, `nbg1`, `hel1`) |
| **Wasabi** | Access key pair | `https://s3.<region>.wasabisys.com` |
| **Scaleway** | IAM API key | `https://s3.<region>.scw.cloud` (`fr-par`, `nl-ams`, `pl-waw`) |
| **OVHcloud** | S3 user credentials | `https://s3.<region>.io.cloud.ovh.net` (High Performance) or `https://s3.<region>.cloud.ovh.net` (Standard) |
| **Storj** | S3 gateway credentials | `https://gateway.storjshare.io`, or your self-hosted gateway URL |
| **MinIO / DigitalOcean Spaces / S3-compatible** | The service's S3 key pair | The service's S3 endpoint — the generic *S3-compatible* entry covers Garage, SeaweedFS, Ceph RGW, LocalStack, … |

## Protocol sources

| Provider | Credentials | Endpoint |
|---|---|---|
| **SFTP** | Username + password | `sftp://host:22` — "Root path" scopes the source to a directory (`/` for the whole tree) |
| **FTP / FTPS** | Username + password | `ftps://host:21` (or `ftp://` — FTPS strongly recommended), root path |
| **WebDAV / Nextcloud** | Username + password (use an app password) | The DAV base URL — for Nextcloud `https://cloud.example.com/remote.php/dav/files/<user>` — root path |

> [!NOTE]
> Protocol sources (SFTP/FTP/WebDAV) have no presigned URLs: downloads,
> previews and thumbnails stream through the app instead of redirecting to
> the storage origin, and the **Copy link** action is unavailable. Listings
> walk the directory tree per request, so very large trees browse slower
> than an object store.

## Local folders

| Provider | Credentials | Root path |
|---|---|---|
| **Local folder** | None | Picked from the `LOCAL_FS_ROOTS` allowlist — the card only appears when the operator sets that variable |

The server operator decides what is exposable: set
`LOCAL_FS_ROOTS=/data,/srv/media` (comma-separated, container-side paths for
Docker) and each "Local folder" source exposes exactly one of those
directories. Files are stored as plain files — no sidecar or metadata files —
so other tools can read and write the same directory; files they drop in show
up in the app with previews. Content types derive from file extensions.
Deleting or moving the last file of a folder also removes the emptied
directory on disk. Like protocol sources, local folders stream through the
app (no presigned URLs, no **Copy link**), and an empty folder created
through the app is materialized by a hidden `.keep` file.

## Adding a new provider

Providers live in `src/lib/storage/providers.ts` — an S3-compatible provider
is one declarative registry entry (label, endpoint placeholder, signing
region, addressing style; its icon goes in
`src/features/sources/components/provider-icons.ts`). A provider with its own
protocol also needs a case in `src/lib/storage/client.ts`.
