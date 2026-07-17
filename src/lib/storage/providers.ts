// Registry of supported storage providers. An S3-compatible provider is one
// entry here — adapter, signing region and addressing style are all config.
// A provider with its own protocol (like Azure) also needs a case in
// lib/storage/client.ts.
// Kept free of UI concerns so server-only modules can import it; the
// provider → icon mapping lives in features/sources/components/provider-icons.ts.
export interface ProviderDefinition {
  id: string;
  label: string;
  adapter: "s3" | "azure" | "sftp" | "ftp" | "webdav";
  /**
   * Region used to sign S3 requests. "from-endpoint" extracts it from the
   * endpoint hostname (AWS, Wasabi, Backblaze, DigitalOcean encode it there).
   */
  region?: string | "from-endpoint";
  /** Path-style addressing (`endpoint/bucket/key`). Default true. */
  forcePathStyle?: boolean;
  endpointPlaceholder: string;
  /** Provider-specific vocabulary for the generic credential fields. */
  fieldLabels: {
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
}

const S3_FIELD_LABELS = {
  bucket: "Bucket",
  accessKeyId: "Access key ID",
  secretAccessKey: "Secret access key",
};

const SYSTEM_FIELD_LABELS = {
  bucket: "Root path",
  accessKeyId: "Username",
  secretAccessKey: "Password",
};

export const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "r2",
    label: "Cloudflare R2",
    adapter: "s3",
    region: "auto",
    endpointPlaceholder: "https://<account-id>.r2.cloudflarestorage.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "aws-s3",
    label: "Amazon S3",
    adapter: "s3",
    region: "from-endpoint",
    forcePathStyle: false, // AWS prefers virtual-hosted addressing
    endpointPlaceholder: "https://s3.<region>.amazonaws.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "gcs",
    label: "Google Cloud Storage",
    adapter: "s3", // S3-interoperability XML API with HMAC keys
    region: "auto",
    endpointPlaceholder: "https://storage.googleapis.com",
    fieldLabels: {
      bucket: "Bucket",
      accessKeyId: "HMAC access key",
      secretAccessKey: "HMAC secret",
    },
  },
  {
    id: "azure-blob",
    label: "Azure Blob Storage",
    adapter: "azure",
    endpointPlaceholder: "https://<account>.blob.core.windows.net",
    fieldLabels: {
      bucket: "Container",
      accessKeyId: "Account name",
      secretAccessKey: "Account key",
    },
  },
  {
    id: "minio",
    label: "MinIO",
    adapter: "s3",
    region: "us-east-1", // MinIO's default; ignored unless configured server-side
    endpointPlaceholder: "https://minio.example.com",
    fieldLabels: {
      bucket: "Bucket",
      accessKeyId: "Access key",
      secretAccessKey: "Secret key",
    },
  },
  {
    id: "digitalocean-spaces",
    label: "DigitalOcean Spaces",
    adapter: "s3",
    region: "from-endpoint",
    endpointPlaceholder: "https://<region>.digitaloceanspaces.com",
    fieldLabels: {
      bucket: "Space",
      accessKeyId: "Access key",
      secretAccessKey: "Secret key",
    },
  },
  {
    id: "backblaze-b2",
    label: "Backblaze B2",
    adapter: "s3",
    region: "from-endpoint", // s3.us-west-002.backblazeb2.com → us-west-002
    forcePathStyle: false,
    endpointPlaceholder: "https://s3.<cluster>.backblazeb2.com",
    fieldLabels: {
      bucket: "Bucket",
      accessKeyId: "Application key ID",
      secretAccessKey: "Application key",
    },
  },
  {
    id: "hetzner",
    label: "Hetzner Object Storage",
    adapter: "s3",
    region: "from-endpoint", // fsn1.your-objectstorage.com → fsn1
    forcePathStyle: false,
    endpointPlaceholder: "https://<location>.your-objectstorage.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "wasabi",
    label: "Wasabi",
    adapter: "s3",
    region: "from-endpoint", // s3.eu-central-1.wasabisys.com → eu-central-1
    forcePathStyle: false,
    endpointPlaceholder: "https://s3.<region>.wasabisys.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "scaleway",
    label: "Scaleway Object Storage",
    adapter: "s3",
    region: "from-endpoint", // s3.fr-par.scw.cloud → fr-par
    forcePathStyle: false,
    endpointPlaceholder: "https://s3.<region>.scw.cloud",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "ovhcloud",
    label: "OVHcloud Object Storage",
    adapter: "s3",
    region: "from-endpoint", // s3.gra.io.cloud.ovh.net → gra
    forcePathStyle: false,
    endpointPlaceholder: "https://s3.<region>.io.cloud.ovh.net",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "storj",
    label: "Storj",
    adapter: "s3",
    // SigV4 needs some region in the signature; the gateway ignores it.
    region: "us-east-1",
    endpointPlaceholder: "https://gateway.storjshare.io",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "akamai",
    label: "Akamai / Linode Object Storage",
    adapter: "s3",
    region: "from-endpoint", // us-east-1.linodeobjects.com → us-east-1
    forcePathStyle: false,
    endpointPlaceholder: "https://<region>.linodeobjects.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "idrive-e2",
    label: "IDrive e2",
    adapter: "s3",
    region: "us-east-1", // gateway ignores it; keep a valid SigV4 default
    endpointPlaceholder: "https://<region>.idrivee2-XX.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "vultr",
    label: "Vultr Object Storage",
    adapter: "s3",
    region: "from-endpoint", // ewr1.vultrobjects.com → ewr1
    forcePathStyle: false,
    endpointPlaceholder: "https://<region>.vultrobjects.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "filebase",
    label: "Filebase",
    adapter: "s3",
    region: "us-east-1",
    endpointPlaceholder: "https://s3.filebase.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "exoscale",
    label: "Exoscale SOS",
    adapter: "s3",
    region: "from-endpoint", // sos-ch-gva-2.exo.io → ch-gva-2
    forcePathStyle: false,
    endpointPlaceholder: "https://sos-<zone>.exo.io",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "oracle-cloud",
    label: "Oracle Cloud Object Storage",
    adapter: "s3",
    region: "from-endpoint", // …objectstorage.<region>.oraclecloud.com
    endpointPlaceholder:
      "https://<namespace>.compat.objectstorage.<region>.oraclecloud.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "ibm-cos",
    label: "IBM Cloud Object Storage",
    adapter: "s3",
    region: "from-endpoint", // s3.<region>.cloud-object-storage… → <region>
    endpointPlaceholder:
      "https://s3.<region>.cloud-object-storage.appdomain.cloud",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "tigris",
    label: "Tigris",
    adapter: "s3",
    region: "auto",
    endpointPlaceholder: "https://fly.storage.tigris.dev",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "tencent-cos",
    label: "Tencent Cloud COS",
    adapter: "s3",
    region: "from-endpoint", // cos.<region>.myqcloud.com → <region>
    forcePathStyle: false,
    endpointPlaceholder: "https://cos.<region>.myqcloud.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "alibaba-oss",
    label: "Alibaba Cloud OSS",
    adapter: "s3",
    region: "from-endpoint", // oss-<region>.aliyuncs.com → <region>
    forcePathStyle: false,
    endpointPlaceholder: "https://oss-<region>.aliyuncs.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "yandex",
    label: "Yandex Object Storage",
    adapter: "s3",
    region: "ru-central1",
    endpointPlaceholder: "https://storage.yandexcloud.net",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    // Catch-all for anything speaking the S3 API without a dedicated entry:
    // Garage, SeaweedFS, Ceph RGW, LocalStack, …
    id: "s3-compatible",
    label: "S3-compatible",
    adapter: "s3",
    region: "us-east-1", // the de-facto default; most services ignore it
    endpointPlaceholder: "https://storage.example.com",
    fieldLabels: {
      bucket: "Bucket",
      accessKeyId: "Access key",
      secretAccessKey: "Secret key",
    },
  },
  // Protocol sources (no presigned URLs — downloads/previews stream through
  // the app; the share action is unavailable). "Bucket" holds the root path.
  {
    id: "sftp",
    label: "SFTP",
    adapter: "sftp",
    endpointPlaceholder: "sftp://files.example.com:22",
    fieldLabels: SYSTEM_FIELD_LABELS,
  },
  {
    id: "ftp",
    label: "FTP / FTPS",
    adapter: "ftp",
    endpointPlaceholder: "ftps://ftp.example.com:21",
    fieldLabels: SYSTEM_FIELD_LABELS,
  },
  {
    id: "webdav",
    label: "WebDAV / Nextcloud",
    adapter: "webdav",
    endpointPlaceholder:
      "https://cloud.example.com/remote.php/dav/files/<user>",
    fieldLabels: SYSTEM_FIELD_LABELS,
  },
];

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

export type EndpointCheck =
  | { ok: true; value: string }
  | { ok: false; message: string };

/**
 * Validates and normalizes a source endpoint for its provider's protocol
 * family. HTTP object stores normalize to the origin; WebDAV keeps its path
 * (endpoints live under one, e.g. /remote.php/dav/files/<user>); SFTP/FTP
 * reduce to scheme + host[:port] — `URL.origin` is "null" for non-special
 * schemes, hence the manual rebuild.
 */
export function normalizeEndpoint(
  providerId: string,
  raw: string,
): EndpointCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, message: "Must be a valid URL." };
  }

  const hostPort = `${url.hostname}${url.port ? `:${url.port}` : ""}`;
  switch (getProvider(providerId)?.adapter ?? "s3") {
    case "webdav": {
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return { ok: false, message: "Must be an http(s):// URL." };
      }
      return {
        ok: true,
        value: `${url.origin}${url.pathname.replace(/\/+$/, "")}`,
      };
    }
    case "sftp":
      if (url.protocol !== "sftp:") {
        return { ok: false, message: "Must be an sftp:// URL." };
      }
      return { ok: true, value: `sftp://${hostPort}` };
    case "ftp":
      if (url.protocol !== "ftp:" && url.protocol !== "ftps:") {
        return { ok: false, message: "Must be an ftp:// or ftps:// URL." };
      }
      return { ok: true, value: `${url.protocol}//${hostPort}` };
    default:
      if (url.protocol !== "https:") {
        return { ok: false, message: "Must be a valid https:// URL." };
      }
      return { ok: true, value: url.origin };
  }
}
