// Integration test against a real S3 endpoint (MinIO in CI). Skipped unless
// S3_TEST_ENDPOINT is set — locally: run a MinIO container and
//   S3_TEST_ENDPOINT=http://localhost:9000 pnpm vitest run features/browser/integration.test.ts

import {
  CreateBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { beforeAll, describe, expect, it } from "vitest";
import { listFolder } from "@/features/browser/service";
import type { Source } from "@/lib/dal/sources";

const endpoint = process.env.S3_TEST_ENDPOINT;
const accessKeyId = process.env.S3_TEST_ACCESS_KEY ?? "minioadmin";
const secretAccessKey = process.env.S3_TEST_SECRET_KEY ?? "minioadmin";

const source: Source = {
  id: "integration-test",
  name: "Integration",
  provider: "minio",
  endpoint: endpoint ?? "",
  bucket: "bucket-ui-test",
  accessKeyId,
  secretAccessKey,
  allowUpload: false,
  allowDelete: false,
};

describe.skipIf(!endpoint)("listFolder against a real S3 endpoint", () => {
  beforeAll(async () => {
    const client = new S3Client({
      endpoint,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
    try {
      await client.send(new CreateBucketCommand({ Bucket: source.bucket }));
    } catch (error) {
      if ((error as Error).name !== "BucketAlreadyOwnedByYou") throw error;
    }
    await Promise.all(
      ["logo.png", "docs/readme.md", "docs/guides/intro.md"].map((key) =>
        client.send(
          new PutObjectCommand({
            Bucket: source.bucket,
            Key: key,
            Body: `content of ${key}`,
          }),
        ),
      ),
    );
  });

  it("lists root folders and files", async () => {
    const result = await listFolder(source, "");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.folders.map((f) => f.name)).toEqual(["docs"]);
    expect(result.files.map((f) => f.name)).toEqual(["logo.png"]);
  });

  it("descends one folder level at a time", async () => {
    const result = await listFolder(source, "docs/");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.folders.map((f) => f.name)).toEqual(["guides"]);
    expect(result.files.map((f) => f.name)).toEqual(["readme.md"]);
  });

  it("classifies rejected credentials", async () => {
    const result = await listFolder(
      { ...source, secretAccessKey: "definitely-wrong" },
      "",
    );
    expect(result).toEqual({ ok: false, reason: "credentials" });
  });

  it("classifies a missing bucket", async () => {
    const result = await listFolder(
      { ...source, bucket: "does-not-exist-bucket-ui" },
      "",
    );
    expect(result).toEqual({ ok: false, reason: "bucket-missing" });
  });
});
