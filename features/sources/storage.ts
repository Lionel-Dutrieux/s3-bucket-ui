import "server-only";
import { Files } from "files-sdk";
import { azure } from "files-sdk/azure";
import { s3 } from "files-sdk/s3";

export interface StorageCredentials {
  provider: string;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getFilesClient(credentials: StorageCredentials): Files {
  switch (credentials.provider) {
    case "azure-blob":
      return new Files({
        adapter: azure({
          container: credentials.bucket,
          accountName: credentials.accessKeyId,
          accountKey: credentials.secretAccessKey,
          endpoint: credentials.endpoint,
        }),
      });
    default:
      // S3-compatible providers (Cloudflare R2, …). Passing the endpoint
      // verbatim also covers jurisdiction-specific R2 endpoints.
      return new Files({
        adapter: s3({
          bucket: credentials.bucket,
          endpoint: credentials.endpoint,
          region: "auto",
          forcePathStyle: true, // R2 supports both styles; path-style keeps the endpoint host untouched
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
          },
        }),
      });
  }
}
