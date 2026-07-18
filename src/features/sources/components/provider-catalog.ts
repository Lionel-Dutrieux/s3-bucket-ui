import { PROVIDERS, type ProviderDefinition } from "@/lib/storage/providers";

// Picker copy: one hint per provider, plus the search words people actually
// type that the label doesn't contain (parent brands, backing engines).
const CATALOG: Record<string, { hint: string; keywords?: string }> = {
  r2: { hint: "Cloudflare object storage", keywords: "cloudflare" },
  "aws-s3": { hint: "Amazon Web Services", keywords: "amazon aws" },
  gcs: { hint: "S3 interop with HMAC keys", keywords: "google gcp" },
  "azure-blob": { hint: "Microsoft Azure containers", keywords: "microsoft" },
  minio: { hint: "Self-hosted, S3-compatible", keywords: "self hosted" },
  "digitalocean-spaces": {
    hint: "Spaces object storage",
    keywords: "digital ocean",
  },
  "backblaze-b2": { hint: "B2 cloud storage" },
  hetzner: { hint: "Hetzner object storage" },
  wasabi: { hint: "Hot cloud storage" },
  scaleway: { hint: "Scaleway object storage" },
  ovhcloud: { hint: "OVH object storage", keywords: "ovh" },
  storj: { hint: "Distributed, S3 gateway" },
  "s3-compatible": {
    hint: "Garage, Ceph, SeaweedFS…",
    keywords: "garage ceph seaweedfs localstack rgw generic custom other",
  },
  akamai: {
    hint: "Linode object storage",
    keywords: "linode akamai connected cloud",
  },
  "idrive-e2": { hint: "IDrive e2 storage", keywords: "idrive" },
  vultr: { hint: "Vultr object storage" },
  filebase: { hint: "IPFS-backed, S3 API", keywords: "ipfs" },
  exoscale: { hint: "Exoscale SOS", keywords: "sos" },
  "oracle-cloud": { hint: "OCI object storage", keywords: "oracle oci" },
  "ibm-cos": { hint: "IBM Cloud object storage", keywords: "ibm cos" },
  tigris: { hint: "Globally distributed S3", keywords: "fly" },
  "tencent-cos": { hint: "Tencent Cloud COS", keywords: "tencent qcloud" },
  "alibaba-oss": { hint: "Alibaba Cloud OSS", keywords: "alibaba aliyun oss" },
  yandex: { hint: "Yandex object storage" },
  sftp: { hint: "Any server over SSH", keywords: "ssh" },
  ftp: { hint: "Plain FTP or over TLS", keywords: "ftps" },
  webdav: { hint: "Nextcloud, ownCloud…", keywords: "nextcloud owncloud dav" },
  local: {
    hint: "Server filesystem folder",
    keywords: "local filesystem folder directory disk volume mount fs",
  },
};

export function providerHint(providerId: string): string {
  return CATALOG[providerId]?.hint ?? "";
}

export interface ProviderGroup {
  label: string;
  providers: ProviderDefinition[];
}

/**
 * Providers matching a search, grouped the way they behave: object stores
 * hand out presigned links, servers & protocols stream through the app.
 */
export function searchProviders(
  query: string,
  opts?: { localFsEnabled?: boolean },
): ProviderGroup[] {
  const q = query.trim().toLowerCase();
  const matches = PROVIDERS.filter((def) => {
    if (def.adapter === "fs" && !opts?.localFsEnabled) return false;
    if (!q) return true;
    const { hint = "", keywords = "" } = CATALOG[def.id] ?? {};
    return `${def.label} ${def.id} ${hint} ${keywords}`
      .toLowerCase()
      .includes(q);
  });
  const isObjectStore = (def: ProviderDefinition) =>
    def.adapter === "s3" || def.adapter === "azure";
  return [
    { label: "Object storage", providers: matches.filter(isObjectStore) },
    {
      label: "Servers & protocols",
      providers: matches.filter((def) => !isObjectStore(def)),
    },
  ].filter((group) => group.providers.length > 0);
}
