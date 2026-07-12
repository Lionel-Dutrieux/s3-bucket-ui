import { Cloud, Cylinder, type LucideIcon } from "lucide-react";

// Registry of supported storage providers. Adding a provider here makes it
// appear in the "Add source" dialog and in the sidebar grouping; if it needs
// a non-S3 adapter, also handle its id in features/sources/storage.ts.
export interface ProviderDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  endpointPlaceholder: string;
  /** Provider-specific vocabulary for the generic credential fields. */
  fieldLabels: {
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "r2",
    label: "Cloudflare R2",
    icon: Cylinder,
    endpointPlaceholder: "https://<account-id>.r2.cloudflarestorage.com",
    fieldLabels: {
      bucket: "Bucket",
      accessKeyId: "Access key ID",
      secretAccessKey: "Secret access key",
    },
  },
  {
    id: "azure-blob",
    label: "Azure Blob Storage",
    icon: Cloud,
    endpointPlaceholder: "https://<account>.blob.core.windows.net",
    fieldLabels: {
      bucket: "Container",
      accessKeyId: "Account name",
      secretAccessKey: "Account key",
    },
  },
];

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}
