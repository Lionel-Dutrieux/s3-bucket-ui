import { describe, expect, it } from "vitest";
import { regionFromEndpoint } from "@/lib/storage/region";

describe("regionFromEndpoint", () => {
  it("extracts the region from a regional AWS endpoint", () => {
    expect(regionFromEndpoint("https://s3.eu-west-3.amazonaws.com")).toBe(
      "eu-west-3",
    );
  });

  it("falls back to us-east-1 for the legacy global AWS endpoint", () => {
    expect(regionFromEndpoint("https://s3.amazonaws.com")).toBe("us-east-1");
  });

  it("uses the first label for DigitalOcean Spaces", () => {
    expect(regionFromEndpoint("https://nyc3.digitaloceanspaces.com")).toBe(
      "nyc3",
    );
  });
});
