import { describe, expect, it } from "vitest";
import { brandThemeCss, hexToOklch } from "@/lib/branding/color";

describe("hexToOklch", () => {
  it("converts white and black to the achromatic extremes", () => {
    const white = hexToOklch("#ffffff");
    expect(white?.l).toBeCloseTo(1, 2);
    expect(white?.c).toBeCloseTo(0, 2);
    const black = hexToOklch("#000000");
    expect(black?.l).toBeCloseTo(0, 2);
  });

  it("matches the app's default amber (#D97706 ≈ oklch(0.666 0.179 58.32))", () => {
    const amber = hexToOklch("#D97706");
    expect(amber?.l).toBeCloseTo(0.666, 2);
    expect(amber?.c).toBeCloseTo(0.179, 1);
    expect(amber?.h).toBeCloseTo(58.32, 0);
  });

  it("accepts a missing # prefix and rejects garbage", () => {
    expect(hexToOklch("d97706")).not.toBeNull();
    expect(hexToOklch("#abc")).toBeNull();
    expect(hexToOklch("not-a-color")).toBeNull();
    expect(hexToOklch("#GGGGGG")).toBeNull();
  });
});

describe("brandThemeCss", () => {
  it("returns null on invalid input", () => {
    expect(brandThemeCss("nope")).toBeNull();
  });

  it("emits light and dark overrides for every themed variable", () => {
    const css = brandThemeCss("#2563EB");
    expect(css).not.toBeNull();
    expect(css).toContain(":root {");
    expect(css).toContain(".dark {");
    for (const name of [
      "--primary:",
      "--primary-foreground:",
      "--ring:",
      "--sidebar-primary:",
      "--sidebar-primary-foreground:",
    ]) {
      // Each variable appears twice: once per mode.
      expect(css?.split(name)).toHaveLength(3);
    }
  });

  it("picks a readable foreground: white text on dark brands, dark text on light brands", () => {
    // Dark navy → white-ish foreground in light mode.
    expect(brandThemeCss("#1E3A8A")).toContain(
      "--primary-foreground: oklch(0.985 0 0)",
    );
    // Near-white brand → dark foreground in light mode.
    expect(brandThemeCss("#F1F5F9")).not.toContain(
      "--primary-foreground: oklch(0.985 0 0);\n  --ring",
    );
  });
});
