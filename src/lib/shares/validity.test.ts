import { describe, expect, it } from "vitest";
import {
  isDownloadLimitReached,
  isShareLive,
  type ShareValidity,
} from "./validity";

const now = new Date("2026-07-18T12:00:00Z");

function share(overrides: Partial<ShareValidity> = {}): ShareValidity {
  return {
    revokedAt: null,
    expiresAt: null,
    downloads: 0,
    maxDownloads: null,
    ...overrides,
  };
}

describe("isDownloadLimitReached", () => {
  it("never reached when the cap is null (unlimited)", () => {
    expect(isDownloadLimitReached(0, null)).toBe(false);
    expect(isDownloadLimitReached(9999, null)).toBe(false);
  });

  it("reached once downloads meet or exceed the cap", () => {
    expect(isDownloadLimitReached(0, 3)).toBe(false);
    expect(isDownloadLimitReached(2, 3)).toBe(false);
    expect(isDownloadLimitReached(3, 3)).toBe(true);
    expect(isDownloadLimitReached(4, 3)).toBe(true);
  });
});

describe("isShareLive", () => {
  it("live by default (no revoke, no expiry, no cap)", () => {
    expect(isShareLive(share(), now)).toBe(true);
  });

  it("dead once revoked", () => {
    expect(isShareLive(share({ revokedAt: now }), now)).toBe(false);
  });

  it("dead at or past expiry, live before it", () => {
    expect(
      isShareLive(share({ expiresAt: new Date("2026-07-18T11:59:59Z") }), now),
    ).toBe(false);
    expect(isShareLive(share({ expiresAt: now }), now)).toBe(false);
    expect(
      isShareLive(share({ expiresAt: new Date("2026-07-18T12:00:01Z") }), now),
    ).toBe(true);
  });

  it("dead once the download cap is reached", () => {
    expect(isShareLive(share({ downloads: 5, maxDownloads: 5 }), now)).toBe(
      false,
    );
    expect(isShareLive(share({ downloads: 4, maxDownloads: 5 }), now)).toBe(
      true,
    );
  });

  it("an uncapped link stays live no matter the download count", () => {
    expect(
      isShareLive(share({ downloads: 1000, maxDownloads: null }), now),
    ).toBe(true);
  });
});
