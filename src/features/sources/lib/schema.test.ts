import { describe, expect, it } from "vitest";
import {
  sourceInputSchema,
  sourceUpdateSchema,
} from "@/features/sources/lib/schema";

const validInput = {
  name: "Team documents",
  provider: "r2",
  endpoint: "https://abc123.r2.cloudflarestorage.com",
  bucket: "documents",
  accessKeyId: "key",
  secretAccessKey: "secret",
  allowPublicShares: true,
};

describe("sourceInputSchema", () => {
  it("accepts a valid input", () => {
    const result = sourceInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("normalizes the endpoint to its origin", () => {
    const result = sourceInputSchema.parse({
      ...validInput,
      endpoint: "https://abc123.r2.cloudflarestorage.com/some/path/",
    });
    expect(result.endpoint).toBe("https://abc123.r2.cloudflarestorage.com");
  });

  it("trims whitespace on text fields", () => {
    const result = sourceInputSchema.parse({
      ...validInput,
      name: "  Team documents  ",
      bucket: " documents ",
    });
    expect(result.name).toBe("Team documents");
    expect(result.bucket).toBe("documents");
  });

  it("rejects an http endpoint", () => {
    const result = sourceInputSchema.safeParse({
      ...validInput,
      endpoint: "http://insecure.example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed endpoint", () => {
    const result = sourceInputSchema.safeParse({
      ...validInput,
      endpoint: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown provider", () => {
    const result = sourceInputSchema.safeParse({
      ...validInput,
      provider: "dropbox",
    });
    expect(result.success).toBe(false);
  });

  it("rejects blank required fields", () => {
    const result = sourceInputSchema.safeParse({ ...validInput, name: "   " });
    expect(result.success).toBe(false);
  });
});

describe("local (fs) sources", () => {
  const localInput = {
    name: "Media",
    provider: "local",
    endpoint: "",
    bucket: "/data/media",
    accessKeyId: "",
    secretAccessKey: "",
    allowPublicShares: true,
  };

  it("accepts a local source without endpoint or credentials", () => {
    const parsed = sourceInputSchema.safeParse(localInput);
    expect(parsed.success).toBe(true);
  });

  it("still requires the root path", () => {
    const parsed = sourceInputSchema.safeParse({ ...localInput, bucket: " " });
    expect(parsed.success).toBe(false);
  });

  it("blanks a stray endpoint on parse", () => {
    const parsed = sourceInputSchema.safeParse({
      ...localInput,
      endpoint: "https://stray.example.com",
    });
    expect(parsed.success && parsed.data.endpoint).toBe("");
  });

  it("blanks stray credentials on parse", () => {
    const parsed = sourceInputSchema.safeParse({
      ...localInput,
      accessKeyId: "stray",
      secretAccessKey: "stray",
    });
    expect(parsed.success && parsed.data.accessKeyId).toBe("");
    expect(parsed.success && parsed.data.secretAccessKey).toBe("");
  });

  it("update schema accepts the same shape", () => {
    const parsed = sourceUpdateSchema.safeParse(localInput);
    expect(parsed.success).toBe(true);
  });
});

describe("non-local sources keep their requirements", () => {
  const s3Input = {
    name: "Bucket",
    provider: "minio",
    endpoint: "https://minio.example.com",
    bucket: "files",
    accessKeyId: "",
    secretAccessKey: "",
    allowPublicShares: true,
  };

  it("still requires the access key", () => {
    const parsed = sourceInputSchema.safeParse(s3Input);
    expect(parsed.success).toBe(false);
    expect(
      !parsed.success &&
        parsed.error.issues.some((i) => i.path[0] === "accessKeyId"),
    ).toBe(true);
  });

  it("still requires the secret on create but not on update", () => {
    const withKey = { ...s3Input, accessKeyId: "minioadmin" };
    expect(sourceInputSchema.safeParse(withKey).success).toBe(false);
    expect(sourceUpdateSchema.safeParse(withKey).success).toBe(true);
  });
});
