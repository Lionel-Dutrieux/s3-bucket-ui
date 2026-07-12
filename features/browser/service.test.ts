import { describe, expect, it } from "vitest";
import { classifyStorageError } from "@/features/browser/service";

// Shapes mirror what reaches listFolder in practice: files-sdk FilesError
// (normalized code + original error in cause) or raw SDK/network errors.
describe("classifyStorageError", () => {
  it("maps files-sdk normalized codes", () => {
    expect(classifyStorageError({ code: "Unauthorized" })).toBe("credentials");
    expect(classifyStorageError({ code: "NotFound" })).toBe("bucket-missing");
  });

  it("walks the cause chain for raw AWS errors", () => {
    expect(
      classifyStorageError({
        code: "Provider",
        cause: {
          name: "SignatureDoesNotMatch",
          $metadata: { httpStatusCode: 403 },
        },
      }),
    ).toBe("credentials");
    expect(
      classifyStorageError({
        code: "Provider",
        cause: { name: "NoSuchBucket" },
      }),
    ).toBe("bucket-missing");
  });

  it("finds Node network errors nested under fetch failures", () => {
    expect(
      classifyStorageError({
        name: "TypeError",
        message: "fetch failed",
        cause: { code: "ECONNREFUSED" },
      }),
    ).toBe("network");
  });

  it("falls back to unknown", () => {
    expect(classifyStorageError(new Error("boom"))).toBe("unknown");
    expect(classifyStorageError(undefined)).toBe("unknown");
  });
});
