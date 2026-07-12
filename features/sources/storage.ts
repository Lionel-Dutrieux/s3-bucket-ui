import "server-only";
import { Files } from "files-sdk";
import { azure } from "files-sdk/azure";
import { s3 } from "files-sdk/s3";
import { getProvider } from "@/features/sources/providers";
import { regionFromEndpoint } from "@/features/sources/region";

export interface StorageCredentials {
  provider: string;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getFilesClient(credentials: StorageCredentials): Files {
  const provider = getProvider(credentials.provider);

  if (provider?.adapter === "azure") {
    return new Files({
      adapter: azure({
        container: credentials.bucket,
        accountName: credentials.accessKeyId,
        accountKey: credentials.secretAccessKey,
        endpoint: credentials.endpoint,
      }),
    });
  }

  const region =
    provider?.region === "from-endpoint"
      ? regionFromEndpoint(credentials.endpoint)
      : (provider?.region ?? "auto");

  return new Files({
    adapter: s3({
      bucket: credentials.bucket,
      endpoint: credentials.endpoint,
      region,
      forcePathStyle: provider?.forcePathStyle ?? true,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    }),
  });
}
