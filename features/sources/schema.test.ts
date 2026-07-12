import { describe, expect, it } from "vitest";
import { sourceInputSchema } from "@/features/sources/schema";

const validInput = {
  name: "Team documents",
  provider: "r2",
  endpoint: "https://abc123.r2.cloudflarestorage.com",
  bucket: "documents",
  accessKeyId: "key",
  secretAccessKey: "secret",
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
