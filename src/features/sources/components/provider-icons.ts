import {
  Archive,
  Box,
  Cable,
  Cloud,
  CloudCog,
  Cloudy,
  Cylinder,
  Database,
  Droplets,
  Flame,
  Globe,
  HardDrive,
  type LucideIcon,
  Network,
  Server,
  Snowflake,
  SquareTerminal,
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
  "backblaze-b2": Flame,
  hetzner: Snowflake,
  wasabi: Archive,
  scaleway: CloudCog,
  ovhcloud: Database,
  storj: Network,
  "s3-compatible": HardDrive,
  sftp: SquareTerminal,
  ftp: Cable,
  webdav: Cloudy,
};

export function providerIcon(providerId: string): LucideIcon {
  return PROVIDER_ICONS[providerId] ?? HardDrive;
}
