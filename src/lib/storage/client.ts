import "server-only";
import { type Adapter, createFiles, Files } from "files-sdk";
import { azure } from "files-sdk/azure";
import { s3 } from "files-sdk/s3";
import { zip } from "files-sdk/zip";
import { getProvider } from "@/lib/storage/providers";
import { regionFromEndpoint } from "@/lib/storage/region";

export interface StorageCredentials {
  provider: string;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function buildAdapter(credentials: StorageCredentials): Adapter {
  const provider = getProvider(credentials.provider);

  if (provider?.adapter === "azure") {
    return azure({
      container: credentials.bucket,
      accountName: credentials.accessKeyId,
      accountKey: credentials.secretAccessKey,
      endpoint: credentials.endpoint,
    });
  }

  const region =
    provider?.region === "from-endpoint"
      ? regionFromEndpoint(credentials.endpoint)
      : (provider?.region ?? "auto");

  return s3({
    bucket: credentials.bucket,
    endpoint: credentials.endpoint,
    region,
    forcePathStyle: provider?.forcePathStyle ?? true,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
}

export function getFilesClient(credentials: StorageCredentials): Files {
  return new Files({ adapter: buildAdapter(credentials) });
}

/** Same client with the zip() plugin grafted on — only the archive route pays
 * for it; everything else keeps the plain instance. */
export function getZipFilesClient(credentials: StorageCredentials) {
  return createFiles({
    adapter: buildAdapter(credentials),
    plugins: [zip()] as const,
  });
}
