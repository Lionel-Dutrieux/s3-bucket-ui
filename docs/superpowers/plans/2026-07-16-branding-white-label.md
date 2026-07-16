# Branding & White Labelling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provider brand logos in the sidebar, the real app logo everywhere, and optional admin-configurable white labelling (app name, company logo, primary color).

**Architecture:** Branding settings live as rows in the existing `Setting` key/value table (logo stored as a data-URL). A cached RSC helper `getBranding()` feeds the root layout (metadata + injected CSS theme override), the sidebar, the auth layout and the public share page through a shared `BrandMark` component. The custom logo is served by a public cacheable GET route. Admin edits happen in the existing Admin → Settings page via a TanStack Form + server actions.

**Tech Stack:** Next.js App Router (RSC), Prisma (via `src/lib/dal/` only), zod, TanStack Form kit (`src/forms/`), Tailwind v4 + shadcn oklch CSS variables, Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-07-16-branding-white-label-design.md`

## Global Constraints

- All UI copy is in **English** (the app is English-only).
- Mutations = server actions returning `ActionResult` (`src/lib/action-result.ts`), zod-validated, `currentAdmin()` re-checked server-side.
- Reads = RSC; never a server action for a read.
- Prisma only inside `src/lib/dal/`.
- No cross-feature imports; shared infra goes in `src/lib/` / `src/components/`.
- Verify with `pnpm typecheck && pnpm lint && pnpm test` per task, `pnpm build` at the end. Do NOT run E2E — the user tests the UI manually.
- If Biome flags `<img>` (noImgElement), add a `biome-ignore` comment with reason "custom logo is a data-URL route / arbitrary SVG — next/image does not apply" rather than switching to `next/image`.
- Defaults to preserve: app name `Bucket UI`, amber theme `--primary: oklch(0.666 0.179 58.32)`.

---

### Task 1: Provider brand logos in the sidebar

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx:106-108`

**Interfaces:**
- Consumes: `ProviderPlate` from `src/features/sources/components/provider-logos.tsx` (existing: `{ providerId: string; className?: string }`, falls back to the lucide glyph for unknown providers).
- Produces: nothing new.

- [ ] **Step 1: Swap the generic plate for `ProviderPlate`**

In `src/components/layout/app-sidebar.tsx`, add the import:

```tsx
import { ProviderPlate } from "@/features/sources/components/provider-logos";
```

Replace lines 106–108 (the generic per-source plate inside the source `<Link>`):

```tsx
<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
  <group.icon className="size-4" aria-hidden />
</div>
```

with:

```tsx
<ProviderPlate providerId={source.provider} className="size-8" />
```

Keep `group.icon` in the group label (line 92) — the monochrome glyph fits the muted label row; only the per-source plate becomes the brand mark. Keep the `providerIcon` import (still used at line 51).

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS (no unused imports, no boundary violations).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/app-sidebar.tsx
git commit -m "feat(sidebar): show provider brand logos on source items"
```

---

### Task 2: Ship the app logo in `public/`

**Files:**
- Create: `public/logo.svg` (moved from `docs/assets/logo.svg`)
- Delete: `docs/assets/logo.svg`
- Modify: `README.md:3` (logo path)

**Interfaces:**
- Produces: `/logo.svg` static asset — later tasks use it as the default `logoUrl`.

- [ ] **Step 1: Move the logo**

```bash
git mv docs/assets/logo.svg public/logo.svg
```

- [ ] **Step 2: Update the README**

In `README.md` line 3, change the image `src` from `docs/assets/logo.svg` to `public/logo.svg` (keep `width=110` and everything else as-is).

- [ ] **Step 3: Verify**

Run: `rg -n "docs/assets/logo" README.md docs/ ; rg -n "public/logo.svg" README.md`
Expected: no hit for the old path anywhere, one hit for the new path in README.md.

- [ ] **Step 4: Commit**

```bash
git add -A README.md docs/assets public/logo.svg
git commit -m "chore: serve the app logo from public/ and point the README at it"
```

---

### Task 3: Color derivation library (hex → oklch theme)

**Files:**
- Create: `src/lib/branding/color.ts`
- Test: `src/lib/branding/color.test.ts`

**Interfaces:**
- Produces:
  - `hexToOklch(hex: string): { l: number; c: number; h: number } | null` — `#RRGGBB` (with or without `#`) → oklch; `null` on invalid input.
  - `brandThemeCss(hex: string): string | null` — full CSS override block (`:root { … } .dark { … }`) for `--primary`, `--primary-foreground`, `--ring`, `--sidebar-primary`, `--sidebar-primary-foreground`; `null` on invalid hex.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/branding/color.test.ts`:

```ts
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
    expect(amber?.c).toBeCloseTo(0.179, 2);
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
    expect(brandThemeCss("#1E3A8A")).toContain("--primary-foreground: oklch(0.985 0 0)");
    // Near-white brand → dark foreground in light mode.
    expect(brandThemeCss("#F1F5F9")).not.toContain("--primary-foreground: oklch(0.985 0 0);\n  --ring");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/branding/color.test.ts`
Expected: FAIL — module `@/lib/branding/color` not found.

- [ ] **Step 3: Implement**

Create `src/lib/branding/color.ts`:

```ts
/**
 * Hex → oklch conversion and theme derivation for white labelling. From one
 * admin-picked color we derive the light/dark pair the default amber theme
 * uses: the dark variant is the same hue/chroma lifted in lightness (the
 * stock theme pairs L 0.666 light with 0.769 dark), and each mode's ring
 * borrows the other mode's primary — mirroring globals.css.
 */

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export function hexToOklch(hex: string): Oklch | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  const [r, g, b] = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map(
    (v) => {
      const channel = v / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    },
  );

  // Linear sRGB → OKLab (Björn Ottosson's reference matrices).
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const c = Math.sqrt(okA * okA + okB * okB);
  let h = (Math.atan2(okB, okA) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: okL, c, h: c < 1e-4 ? 0 : h };
}

const round = (value: number) => Math.round(value * 1000) / 1000;
const fmt = ({ l, c, h }: Oklch) => `oklch(${round(l)} ${round(c)} ${round(h)})`;

/** Near-white for dark brands, a hue-tinted near-black for light brands. */
function foregroundFor(color: Oklch): Oklch {
  return color.l >= 0.7
    ? { l: 0.25, c: Math.min(color.c, 0.08), h: color.h }
    : { l: 0.985, c: 0, h: 0 };
}

export function brandThemeCss(hex: string): string | null {
  const base = hexToOklch(hex);
  if (!base) return null;
  const lifted: Oklch = { ...base, l: Math.min(base.l + 0.1, 0.92) };
  const lightFg = foregroundFor(base);
  const darkFg = foregroundFor(lifted);
  return [
    ":root {",
    `  --primary: ${fmt(base)};`,
    `  --primary-foreground: ${fmt(lightFg)};`,
    `  --ring: ${fmt(lifted)};`,
    `  --sidebar-primary: ${fmt(base)};`,
    `  --sidebar-primary-foreground: ${fmt(lightFg)};`,
    "}",
    ".dark {",
    `  --primary: ${fmt(lifted)};`,
    `  --primary-foreground: ${fmt(darkFg)};`,
    `  --ring: ${fmt(base)};`,
    `  --sidebar-primary: ${fmt(lifted)};`,
    `  --sidebar-primary-foreground: ${fmt(darkFg)};`,
    "}",
  ].join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/branding/color.test.ts`
Expected: PASS. If the amber close-to assertion is off by more than the tolerance, print the actual value and adjust ONLY the rounding in the test tolerance (`toBeCloseTo(x, 1)`), never the conversion matrices.

- [ ] **Step 5: Verify & commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

```bash
git add src/lib/branding/color.ts src/lib/branding/color.test.ts
git commit -m "feat(branding): hex to oklch conversion and theme derivation"
```

---

### Task 4: Branding settings (DAL) + cached `getBranding()`

**Files:**
- Modify: `src/lib/dal/settings.ts` (append)
- Create: `src/lib/branding/branding.ts`

**Interfaces:**
- Consumes: `prisma` (inside DAL only), `cache` from `react`.
- Produces (DAL, `src/lib/dal/settings.ts`):
  - `interface BrandingSettings { appName: string | null; logo: string | null; logoVersion: string | null; primaryColor: string | null }`
  - `getBrandingSettings(): Promise<BrandingSettings>`
  - `updateBrandingSettings(input: { appName: string; primaryColor: string | null; logo?: string | null }): Promise<void>` — `logo` undefined → keep, `null` → remove, string → replace (bumps version).
  - `clearBrandingSettings(): Promise<void>`
- Produces (`src/lib/branding/branding.ts`):
  - `DEFAULT_APP_NAME = "Bucket UI"`
  - `interface Branding { appName: string; logoUrl: string; hasCustomLogo: boolean; primaryColor: string | null }`
  - `getBranding(): Promise<Branding>` — memoized per request with `React.cache`; `logoUrl` is `/api/branding/logo?v=<version>` when a custom logo exists, else `/logo.svg`.

- [ ] **Step 1: Extend the settings DAL**

Append to `src/lib/dal/settings.ts`:

```ts
// --- branding (white labelling) ---

const BRANDING_APP_NAME_KEY = "brandingAppName";
const BRANDING_LOGO_KEY = "brandingLogo";
const BRANDING_LOGO_VERSION_KEY = "brandingLogoVersion";
const BRANDING_COLOR_KEY = "brandingPrimaryColor";
const BRANDING_KEYS = [
  BRANDING_APP_NAME_KEY,
  BRANDING_LOGO_KEY,
  BRANDING_LOGO_VERSION_KEY,
  BRANDING_COLOR_KEY,
];

export interface BrandingSettings {
  appName: string | null;
  /** Custom logo as a data-URL (SVG/PNG/WebP), or null when unset. */
  logo: string | null;
  /** Bumped on every logo upload — cache-busts the logo route URL. */
  logoVersion: string | null;
  /** #RRGGBB, or null for the stock amber theme. */
  primaryColor: string | null;
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: BRANDING_KEYS } },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    appName: map.get(BRANDING_APP_NAME_KEY) ?? null,
    logo: map.get(BRANDING_LOGO_KEY) ?? null,
    logoVersion: map.get(BRANDING_LOGO_VERSION_KEY) ?? null,
    primaryColor: map.get(BRANDING_COLOR_KEY) ?? null,
  };
}

async function setStringSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

async function deleteSettings(keys: string[]): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: { in: keys } } });
}

export async function updateBrandingSettings(input: {
  appName: string;
  primaryColor: string | null;
  /** undefined → keep the current logo, null → remove it, string → replace it. */
  logo?: string | null;
}): Promise<void> {
  await setStringSetting(BRANDING_APP_NAME_KEY, input.appName);
  if (input.primaryColor) {
    await setStringSetting(BRANDING_COLOR_KEY, input.primaryColor);
  } else {
    await deleteSettings([BRANDING_COLOR_KEY]);
  }
  if (input.logo === null) {
    await deleteSettings([BRANDING_LOGO_KEY, BRANDING_LOGO_VERSION_KEY]);
  } else if (typeof input.logo === "string") {
    await setStringSetting(BRANDING_LOGO_KEY, input.logo);
    await setStringSetting(BRANDING_LOGO_VERSION_KEY, String(Date.now()));
  }
}

export async function clearBrandingSettings(): Promise<void> {
  await deleteSettings(BRANDING_KEYS);
}
```

- [ ] **Step 2: Create the RSC branding helper**

Create `src/lib/branding/branding.ts`:

```ts
import "server-only";
import { cache } from "react";
import { getBrandingSettings } from "@/lib/dal/settings";

export const DEFAULT_APP_NAME = "Bucket UI";

export interface Branding {
  appName: string;
  /** What an <img src> should render: custom logo route or the bundled default. */
  logoUrl: string;
  hasCustomLogo: boolean;
  /** #RRGGBB, or null for the stock theme. */
  primaryColor: string | null;
}

/**
 * Request-memoized branding snapshot. Every consumer (metadata, layouts,
 * the share page) shares one DB read per request.
 */
export const getBranding = cache(async (): Promise<Branding> => {
  const settings = await getBrandingSettings();
  const hasCustomLogo = Boolean(settings.logo);
  return {
    appName: settings.appName?.trim() || DEFAULT_APP_NAME,
    hasCustomLogo,
    logoUrl: hasCustomLogo
      ? `/api/branding/logo?v=${settings.logoVersion ?? "0"}`
      : "/logo.svg",
    primaryColor: settings.primaryColor,
  };
});
```

- [ ] **Step 3: Verify & commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

```bash
git add src/lib/dal/settings.ts src/lib/branding/branding.ts
git commit -m "feat(branding): branding settings in the DAL and cached getBranding()"
```

---

### Task 5: Branding zod schema + server actions

**Files:**
- Modify: `src/features/admin/lib/schema.ts` (append)
- Test: `src/features/admin/lib/schema.test.ts` (create if absent, else append)
- Modify: `src/features/admin/actions.ts` (append to the `--- settings ---` section)

**Interfaces:**
- Consumes: `updateBrandingSettings` / `clearBrandingSettings` from Task 4, `currentAdmin`, `actionOk`/`actionError`.
- Produces:
  - `brandingSchema` and `type BrandingValues = z.infer<typeof brandingSchema>` — `{ appName: string; primaryColor: string | null; logo?: string | null }`.
  - `BRANDING_LOGO_MAX_BYTES = 524288`
  - `updateBranding(input: BrandingValues): Promise<ActionResult>`
  - `resetBranding(): Promise<ActionResult>`

- [ ] **Step 1: Write the failing schema tests**

In `src/features/admin/lib/schema.test.ts` (create the file if it does not exist, keeping any existing tests):

```ts
import { describe, expect, it } from "vitest";
import {
  BRANDING_LOGO_MAX_BYTES,
  brandingSchema,
} from "@/features/admin/lib/schema";

const svgLogo = `data:image/svg+xml;base64,${Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>").toString("base64")}`;

describe("brandingSchema", () => {
  it("accepts a full valid payload", () => {
    const parsed = brandingSchema.safeParse({
      appName: "  Acme Cloud  ",
      primaryColor: "#2563EB",
      logo: svgLogo,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.appName).toBe("Acme Cloud");
  });

  it("accepts null color (stock theme) and absent/null logo (keep/remove)", () => {
    expect(
      brandingSchema.safeParse({ appName: "Acme", primaryColor: null }).success,
    ).toBe(true);
    expect(
      brandingSchema.safeParse({ appName: "Acme", primaryColor: null, logo: null })
        .success,
    ).toBe(true);
  });

  it("rejects an empty or too-long app name", () => {
    expect(
      brandingSchema.safeParse({ appName: "   ", primaryColor: null }).success,
    ).toBe(false);
    expect(
      brandingSchema.safeParse({ appName: "x".repeat(65), primaryColor: null })
        .success,
    ).toBe(false);
  });

  it("rejects malformed colors", () => {
    for (const primaryColor of ["2563EB", "#25E", "#25 3EB", "blue"]) {
      expect(
        brandingSchema.safeParse({ appName: "Acme", primaryColor }).success,
      ).toBe(false);
    }
  });

  it("rejects non-image data-URLs and oversized logos", () => {
    expect(
      brandingSchema.safeParse({
        appName: "Acme",
        primaryColor: null,
        logo: "data:text/html;base64,PGh0bWw+",
      }).success,
    ).toBe(false);
    const oversized = `data:image/png;base64,${"A".repeat(Math.ceil((BRANDING_LOGO_MAX_BYTES + 1024) / 3) * 4)}`;
    expect(
      brandingSchema.safeParse({ appName: "Acme", primaryColor: null, logo: oversized })
        .success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/admin/lib/schema.test.ts`
Expected: FAIL — `brandingSchema` not exported.

- [ ] **Step 3: Implement the schema**

Append to `src/features/admin/lib/schema.ts` (reuse the file's existing `z` import):

```ts
// --- branding (white labelling) ---

export const BRANDING_LOGO_MAX_BYTES = 512 * 1024;

const LOGO_DATA_URL =
  /^data:image\/(svg\+xml|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Decoded size of a base64 data-URL payload, in bytes. */
function dataUrlBytes(dataUrl: string): number {
  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return (payload.length * 3) / 4 - padding;
}

export const brandingSchema = z.object({
  appName: z
    .string()
    .trim()
    .min(1, "App name is required.")
    .max(64, "Keep the app name under 64 characters."),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB hex color.")
    .nullable(),
  // undefined → keep the current logo, null → remove it, string → replace it.
  logo: z
    .string()
    .regex(LOGO_DATA_URL, "The logo must be an SVG, PNG or WebP image.")
    .refine(
      (value) => dataUrlBytes(value) <= BRANDING_LOGO_MAX_BYTES,
      "The logo must be 512 KB or smaller.",
    )
    .nullish(),
});

export type BrandingValues = z.infer<typeof brandingSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/admin/lib/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the server actions**

In `src/features/admin/actions.ts`, extend the schema import with `type BrandingValues, brandingSchema`, extend the `@/lib/dal/settings` import with `clearBrandingSettings, updateBrandingSettings`, then append after `setOidcOnlyEnabled` (still in the `--- settings ---` section):

```ts
export async function updateBranding(
  input: BrandingValues,
): Promise<ActionResult> {
  if (!(await currentAdmin())) return actionError(NOT_AUTHORIZED);
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    await updateBrandingSettings(parsed.data);
  } catch (error) {
    console.error("[admin] update branding failed:", error);
    return actionError("Could not save the branding settings.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}

export async function resetBranding(): Promise<ActionResult> {
  if (!(await currentAdmin())) return actionError(NOT_AUTHORIZED);

  try {
    await clearBrandingSettings();
  } catch (error) {
    console.error("[admin] reset branding failed:", error);
    return actionError("Could not reset the branding settings.");
  }
  revalidatePath("/", "layout");
  return actionOk();
}
```

- [ ] **Step 6: Verify & commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

```bash
git add src/features/admin/lib/schema.ts src/features/admin/lib/schema.test.ts src/features/admin/actions.ts
git commit -m "feat(admin): branding schema and update/reset server actions"
```

---

### Task 6: Public logo route `GET /api/branding/logo`

**Files:**
- Create: `src/app/api/branding/logo/route.ts`

**Interfaces:**
- Consumes: `getBrandingSettings` (Task 4), `apiError` from `src/lib/api-error.ts` (`apiError(status, message)`).
- Produces: public GET endpoint returning the decoded logo bytes. Consumed via the versioned URL that `getBranding()` builds (`/api/branding/logo?v=<version>`).

- [ ] **Step 1: Implement the route**

Create `src/app/api/branding/logo/route.ts`:

```ts
import { apiError } from "@/lib/api-error";
import { getBrandingSettings } from "@/lib/dal/settings";

/**
 * Serves the admin-uploaded logo. Deliberately public: the login page and
 * public share pages render it before any session exists. The URL carries a
 * version query param (bumped on upload), so responses can be immutable.
 */
export async function GET() {
  const { logo } = await getBrandingSettings();
  if (!logo) return apiError(404, "No custom logo is configured.");

  const mime = logo.slice(5, logo.indexOf(";"));
  const body = Buffer.from(logo.slice(logo.indexOf(",") + 1), "base64");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      // Neutralises scripts inside uploaded SVGs.
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
```

- [ ] **Step 2: Verify & commit**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add src/app/api/branding/logo/route.ts
git commit -m "feat(branding): public cacheable route serving the custom logo"
```

---

### Task 7: Apply branding — BrandMark, sidebar, auth, share page, root layout

**Files:**
- Create: `src/components/layout/brand-mark.tsx`
- Modify: `src/app/layout.tsx` (metadata + theme `<style>`)
- Modify: `src/components/layout/app-sidebar.tsx` (header block, lines 62–70)
- Modify: `src/app/(app)/layout.tsx` (pass branding to the sidebar)
- Modify: `src/app/(auth)/layout.tsx` (both brand blocks)
- Modify: `src/app/s/[token]/page.tsx` (ShareShell header)

**Interfaces:**
- Consumes: `getBranding`/`Branding` (Task 4), `brandThemeCss` (Task 3), `/logo.svg` (Task 2).
- Produces: `BrandMark` client-safe component:
  `({ branding: BrandingInfo; subtitle?: string; className?: string })` with
  `interface BrandingInfo { appName: string; logoUrl: string; hasCustomLogo: boolean }` exported from `brand-mark.tsx`.

- [ ] **Step 1: Create `BrandMark`**

Create `src/components/layout/brand-mark.tsx`:

```tsx
import { cn } from "@/lib/utils";

/** Client-safe subset of Branding (src/lib/branding is server-only). */
export interface BrandingInfo {
  appName: string;
  logoUrl: string;
  hasCustomLogo: boolean;
}

/**
 * The app's brand block. Default branding renders the logo tile next to the
 * app name; a white-label logo replaces the whole block (the company mark
 * usually embeds its own wordmark).
 */
export function BrandMark({
  branding,
  subtitle,
  className,
}: {
  branding: BrandingInfo;
  subtitle?: string;
  className?: string;
}) {
  if (branding.hasCustomLogo) {
    return (
      <span className={cn("flex items-center", className)}>
        {/* biome-ignore lint: the logo comes from a data-URL route serving arbitrary SVG/PNG — next/image does not apply. */}
        <img
          src={branding.logoUrl}
          alt={branding.appName}
          className="max-h-9 max-w-44 object-contain"
        />
      </span>
    );
  }
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {/* biome-ignore lint: static SVG asset, no optimization needed. */}
      <img
        src={branding.logoUrl}
        alt=""
        className="size-8 shrink-0 rounded-lg"
      />
      <span className="grid text-left leading-tight">
        <span className="text-sm font-semibold tracking-tight">
          {branding.appName}
        </span>
        {subtitle ? (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}
```

Note: only keep the `biome-ignore` comments if `pnpm lint` actually flags `<img>`; use the exact rule name Biome reports.

- [ ] **Step 2: Root layout — dynamic metadata and theme override**

In `src/app/layout.tsx`:

1. Add imports:

```tsx
import { getBranding } from "@/lib/branding/branding";
import { brandThemeCss } from "@/lib/branding/color";
```

2. Replace the static `export const metadata` (lines 19–25) with:

```tsx
export async function generateMetadata(): Promise<Metadata> {
  const { appName } = await getBranding();
  return {
    title: { default: appName, template: `%s – ${appName}` },
    description:
      "File manager for your storage buckets — read-only by default.",
  };
}
```

3. Make the layout async and inject the theme override as the first child of `<body>`:

```tsx
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { primaryColor } = await getBranding();
  const themeCss = primaryColor ? brandThemeCss(primaryColor) : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* White-label primary color: overrides the amber defaults from
            globals.css for both modes. Invalid stored colors yield null and
            fall back to the stock theme. */}
        {themeCss ? <style>{themeCss}</style> : null}
        <NuqsAdapter>
          {/* …existing providers unchanged… */}
        </NuqsAdapter>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Sidebar header**

In `src/components/layout/app-sidebar.tsx`:

1. Add a `branding` prop and the import:

```tsx
import {
  BrandMark,
  type BrandingInfo,
} from "@/components/layout/brand-mark";

export function AppSidebar({
  branding,
  sources,
  user,
}: {
  branding: BrandingInfo;
  sources: SourceSummary[];
  user: SidebarUser;
}) {
```

2. Replace the header block (lines 63–70, the `<Link href="/">…</Link>` with the `Cylinder` tile and hardcoded name) with:

```tsx
<Link href="/" className="flex items-center px-1 pt-1">
  <BrandMark branding={branding} />
</Link>
```

3. Remove the now-unused `Cylinder` import.

In `src/app/(app)/layout.tsx`, fetch and pass branding:

```tsx
import { getBranding } from "@/lib/branding/branding";
// …
const session = await requireSession();
const [sources, branding] = await Promise.all([
  listSourcesFor(session.user),
  getBranding(),
]);
// …
<AppSidebar
  branding={branding}
  sources={sources}
  user={{ /* unchanged */ }}
/>
```

(`Branding` structurally satisfies `BrandingInfo`; the extra `primaryColor` field is fine to pass through.)

- [ ] **Step 4: Auth layout**

In `src/app/(auth)/layout.tsx`:

1. Add imports and fetch branding:

```tsx
import { BrandMark } from "@/components/layout/brand-mark";
import { getBranding } from "@/lib/branding/branding";
// …
if (await getSession()) redirect("/");
const branding = await getBranding();
```

2. Replace the desktop brand block (lines 37–45, the tile + « Bucket UI » / « File manager ») with:

```tsx
<div className="relative p-10">
  <BrandMark branding={branding} subtitle="File manager" />
</div>
```

3. Replace the mobile brand block (lines 50–58) with:

```tsx
<div className="lg:hidden">
  <BrandMark branding={branding} subtitle="File manager" />
</div>
```

4. Keep the decorative `Cylinder` watermark (lines 31–35) — it inherits `text-primary/10`, so it follows the custom color.

- [ ] **Step 5: Public share page**

In `src/app/s/[token]/page.tsx`:

1. Add imports, remove the `Cylinder` import:

```tsx
import { BrandMark, type BrandingInfo } from "@/components/layout/brand-mark";
import { getBranding } from "@/lib/branding/branding";
```

2. `ShareShell` takes branding; fetch it in `SharePage` (once, before the early returns) and pass it to both `ShareShell` call sites:

```tsx
const branding = await getBranding();
// …
<ShareShell branding={branding}>…</ShareShell>
```

3. Update `ShareShell` (replace the header block, lines 61–68):

```tsx
function ShareShell({
  branding,
  children,
}: {
  branding: BrandingInfo;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex justify-center">
          <BrandMark branding={branding} />
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Sweep for leftover hardcoded branding**

Run: `rg -n "Bucket UI" src/`
Expected remaining hits ONLY in: `src/lib/branding/branding.ts` (`DEFAULT_APP_NAME`), comments, and `provider-logos.tsx`/tests if any. No user-visible hardcoded « Bucket UI » outside the default constant. Fix any stragglers by consuming `getBranding()`.

- [ ] **Step 7: Verify & commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

```bash
git add src/components/layout/brand-mark.tsx src/components/layout/app-sidebar.tsx src/app/layout.tsx "src/app/(app)/layout.tsx" "src/app/(auth)/layout.tsx" "src/app/s/[token]/page.tsx"
git commit -m "feat(branding): white-label logo, name and primary color across the app"
```

---

### Task 8: Admin Branding form

**Files:**
- Create: `src/features/admin/components/branding-form.tsx`
- Modify: `src/app/(app)/admin/settings/page.tsx`

**Interfaces:**
- Consumes: `updateBranding`/`resetBranding` (Task 5), `useAppForm` (`src/forms/form.ts`; usage mirrors `src/features/sources/components/source-form.tsx`: `form.AppField` + `field.TextField`, `form.AppForm` + `form.SubmitButton`), `getBranding` + `DEFAULT_APP_NAME` (Task 4), `BRANDING_LOGO_MAX_BYTES` (Task 5).
- Produces: `BrandingForm({ appName, primaryColor, logoUrl }: { appName: string; primaryColor: string | null; logoUrl: string | null })`.

- [ ] **Step 1: Create the form component**

Create `src/features/admin/components/branding-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetBranding, updateBranding } from "@/features/admin/actions";
import { BRANDING_LOGO_MAX_BYTES } from "@/features/admin/lib/schema";
import { useAppForm } from "@/forms/form";

const ACCEPTED_TYPES = ["image/svg+xml", "image/png", "image/webp"];

export function BrandingForm({
  appName,
  primaryColor,
  logoUrl,
}: {
  appName: string;
  primaryColor: string | null;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [resetting, startReset] = useTransition();

  const form = useAppForm({
    defaultValues: {
      appName,
      // "" means "stock theme" — mapped to null on submit.
      primaryColor: primaryColor ?? "",
      // undefined → keep current logo, null → remove, string → new data-URL.
      logo: undefined as string | null | undefined,
    },
    onSubmit: async ({ value }) => {
      const result = await updateBranding({
        appName: value.appName,
        primaryColor: value.primaryColor || null,
        logo: value.logo,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Branding updated");
      router.refresh();
    },
  });

  const reset = () =>
    startReset(async () => {
      const result = await resetBranding();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      form.reset({ appName: "Bucket UI", primaryColor: "", logo: undefined });
      toast.success("Branding reset to defaults");
      router.refresh();
    });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-4 rounded-xl border bg-card p-4 shadow-sm"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">White labelling</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          Rebrand this instance: the name, logo and primary color apply to the
          sidebar, the sign-in page, public share pages and the browser tab.
        </p>
      </div>

      <form.AppField name="appName">
        {(field) => (
          <field.TextField label="Application name" placeholder="Bucket UI" />
        )}
      </form.AppField>

      <form.AppField name="primaryColor">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="branding-color">Primary color</Label>
            <div className="flex items-center gap-2">
              <input
                id="branding-color"
                type="color"
                // The native picker cannot represent "unset" — show the
                // stock amber when no custom color is stored.
                value={field.state.value || "#D97706"}
                onChange={(event) => field.handleChange(event.target.value)}
                className="size-9 cursor-pointer rounded-lg border bg-background p-1"
              />
              <span className="font-mono text-sm text-muted-foreground">
                {field.state.value || "Default (amber)"}
              </span>
              {field.state.value ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => field.handleChange("")}
                >
                  Use default
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </form.AppField>

      <form.AppField name="logo">
        {(field) => {
          // undefined = keep whatever is stored server-side.
          const preview =
            field.state.value === undefined ? logoUrl : field.state.value;
          return (
            <div className="space-y-2">
              <Label htmlFor="branding-logo">Custom logo</Label>
              <div className="flex items-center gap-3">
                {preview ? (
                  // biome-ignore lint: data-URL preview of the uploaded logo.
                  <img
                    src={preview}
                    alt="Logo preview"
                    className="max-h-9 max-w-36 rounded border bg-muted/40 object-contain p-1"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    None — the app name is shown instead.
                  </span>
                )}
                <Input
                  id="branding-logo"
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  className="max-w-56"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (!ACCEPTED_TYPES.includes(file.type)) {
                      toast.error("Use an SVG, PNG or WebP image.");
                      return;
                    }
                    if (file.size > BRANDING_LOGO_MAX_BYTES) {
                      toast.error("The logo must be 512 KB or smaller.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      field.handleChange(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                />
                {preview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => field.handleChange(null)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                SVG, PNG or WebP, 512 KB max. Replaces the app name in the
                sidebar — a horizontal mark with the company name works best.
              </p>
            </div>
          );
        }}
      </form.AppField>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={resetting}
          onClick={reset}
        >
          Reset branding
        </Button>
        <form.AppForm>
          <form.SubmitButton pendingLabel="Saving…">
            Save branding
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
```

Adjust imports to whatever the shadcn `Input`/`Label`/`Button` paths are in this repo (`@/components/ui/…`). If `form.reset(values)` is not the right TanStack Form API in the installed version, use `form.reset()` after `router.refresh()` — check how other forms in the repo do it.

- [ ] **Step 2: Add the section to the settings page**

In `src/app/(app)/admin/settings/page.tsx`:

```tsx
import { BrandingForm } from "@/features/admin/components/branding-form";
import { getBranding } from "@/lib/branding/branding";
// …
const [signUpEnabled, oidcOnly, sharingEnabled, branding] = await Promise.all([
  isPublicSignUpEnabled(),
  isOidcOnly(),
  isPublicSharingEnabled(),
  getBranding(),
]);
// … after <SettingsForm …/>:
<BrandingForm
  appName={branding.appName}
  primaryColor={branding.primaryColor}
  logoUrl={branding.hasCustomLogo ? branding.logoUrl : null}
/>
```

Wrap the two forms in a `<div className="space-y-6">` if the page needs spacing between the existing card and the new one.

- [ ] **Step 3: Verify & commit**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: PASS (full build green — this is the last task).

```bash
git add src/features/admin/components/branding-form.tsx "src/app/(app)/admin/settings/page.tsx"
git commit -m "feat(admin): branding section in settings — name, logo and primary color"
```

---

## Final verification

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green.
- [ ] `rg -n "Bucket UI" src/` → only `DEFAULT_APP_NAME` and comments.
- [ ] Hand the branch to the user for manual UI testing (sidebar provider logos, default logo, custom logo/name/color, reset, login page, share page, dark mode). Do NOT run E2E.
