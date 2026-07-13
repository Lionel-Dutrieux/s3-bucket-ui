import { describe, expect, it } from "vitest";
import { formatBytes, formatDate } from "@/lib/format";

describe("formatBytes", () => {
  it("formats zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("keeps bytes as integers", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("shows one decimal under 10 units", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("rounds at 10 units and above", () => {
    expect(formatBytes(10 * 1024)).toBe("10 KB");
  });

  it("caps at terabytes", () => {
    expect(formatBytes(5 * 1024 ** 4)).toBe("5 TB");
  });
});

describe("formatDate", () => {
  it("renders a dash when missing", () => {
    expect(formatDate(undefined)).toBe("—");
  });

  it("formats a timestamp", () => {
    expect(formatDate(Date.UTC(2026, 6, 12))).toMatch(/Jul.*2026/);
  });
});
