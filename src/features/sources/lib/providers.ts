// Registry of supported storage providers. An S3-compatible provider is one
// entry here — adapter, signing region and addressing style are all config.
// A provider with its own protocol (like Azure) also needs a case in
// features/sources/server/storage.ts.
// Kept free of UI concerns so server-only modules can import it; the
// provider → icon mapping lives in components/provider-icons.ts.
export interface ProviderDefinition {
  id: string;
  label: string;
  adapter: "s3" | "azure";
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
];

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}
