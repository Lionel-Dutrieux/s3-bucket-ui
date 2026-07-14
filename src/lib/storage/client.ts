import "server-only";
import { type Adapter, createFiles, Files } from "files-sdk";
import { azure } from "files-sdk/azure";
import { ftp } from "files-sdk/ftp";
import { s3 } from "files-sdk/s3";
import { sftp } from "files-sdk/sftp";
import { webdav } from "files-sdk/webdav";
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

  // Protocol sources reuse the generic credential fields: the endpoint is a
  // scheme://host[:port] (or a WebDAV base URL), "bucket" is the root path,
  // and the key pair is username/password.
  if (provider?.adapter === "sftp") {
    const url = new URL(credentials.endpoint);
    return sftp({
      host: url.hostname,
      port: url.port ? Number(url.port) : 22,
      username: credentials.accessKeyId,
      password: credentials.secretAccessKey,
      root: credentials.bucket,
    });
  }
  if (provider?.adapter === "ftp") {
    const url = new URL(credentials.endpoint);
    return ftp({
      host: url.hostname,
      port: url.port ? Number(url.port) : 21,
      user: credentials.accessKeyId,
      password: credentials.secretAccessKey,
      secure: url.protocol === "ftps:",
      root: credentials.bucket,
    });
  }
  if (provider?.adapter === "webdav") {
    return webdav({
      baseUrl: credentials.endpoint,
      username: credentials.accessKeyId,
      password: credentials.secretAccessKey,
      root: credentials.bucket,
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
