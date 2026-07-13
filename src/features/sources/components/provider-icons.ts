import {
  Box,
  Cloud,
  Cylinder,
  Droplets,
  Globe,
  HardDrive,
  type LucideIcon,
  Server,
} from "lucide-react";

// UI counterpart of lib/providers.ts — kept separate so the provider
// registry stays importable from server-only modules.
const PROVIDER_ICONS: Record<string, LucideIcon> = {
  r2: Cylinder,
  "aws-s3": Box,
  gcs: Globe,
  "azure-blob": Cloud,
  minio: Server,
  "digitalocean-spaces": Droplets,
};

export function providerIcon(providerId: string): LucideIcon {
  return PROVIDER_ICONS[providerId] ?? HardDrive;
}
