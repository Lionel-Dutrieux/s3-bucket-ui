import {
  Box,
  Cloud,
  Cylinder,
  Droplets,
  Flame,
  Globe,
  Layers,
  Server,
  type LucideIcon,
} from "lucide-react";

// Registry of supported storage providers. An S3-compatible provider is one
// entry here — adapter, signing region and addressing style are all config.
// A provider with its own protocol (like Azure) also needs a case in
// features/sources/storage.ts.
export interface ProviderDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
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
    icon: Cylinder,
    adapter: "s3",
    region: "auto",
    endpointPlaceholder: "https://<account-id>.r2.cloudflarestorage.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "aws-s3",
    label: "Amazon S3",
    icon: Box,
    adapter: "s3",
    region: "from-endpoint",
    forcePathStyle: false, // AWS prefers virtual-hosted addressing
    endpointPlaceholder: "https://s3.<region>.amazonaws.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "gcs",
    label: "Google Cloud Storage",
    icon: Globe,
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
    icon: Cloud,
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
    icon: Server,
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
    id: "wasabi",
    label: "Wasabi",
    icon: Layers,
    adapter: "s3",
    region: "from-endpoint",
    endpointPlaceholder: "https://s3.<region>.wasabisys.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "backblaze-b2",
    label: "Backblaze B2",
    icon: Flame,
    adapter: "s3",
    region: "from-endpoint",
    endpointPlaceholder: "https://s3.<region>.backblazeb2.com",
    fieldLabels: {
      bucket: "Bucket",
      accessKeyId: "Key ID",
      secretAccessKey: "Application key",
    },
  },
  {
    id: "digitalocean-spaces",
    label: "DigitalOcean Spaces",
    icon: Droplets,
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
