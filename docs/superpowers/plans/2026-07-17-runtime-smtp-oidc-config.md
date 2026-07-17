# Runtime SMTP/OIDC Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SMTP et OIDC configurables depuis Admin → Settings, variables d'env comme défauts, override DB champ par champ, prise d'effet à chaud (better-auth reconstruit sur changement de version).

**Architecture:** Un module pur `src/lib/config/resolve.ts` fusionne overrides DB et défauts env (testable sans DB) ; `src/lib/config/index.ts` fait le pont DAL + env. Les secrets sont chiffrés via `lib/crypto.ts` dans la table `Setting` existante. `auth.ts` remplace son singleton par une fabrique `getAuth()` versionnée (clé `configVersion`, TTL 5 s). Deux nouvelles cartes de formulaire sur la page Admin → Settings.

**Tech Stack:** Next.js (App Router, RSC), better-auth, Prisma (table `Setting` existante — zéro migration), zod, TanStack Form kit (`src/forms/`, `useAppForm`), next-intl, nodemailer, vitest.

## Global Constraints

- Spec : `docs/superpowers/specs/2026-07-17-runtime-smtp-oidc-config-design.md`.
- Conventions : `ARCHITECTURE.md` — pas d'import cross-feature, pas de barrel files, Prisma uniquement dans `src/lib/dal/`, actions via `withAdmin` + zod + `ActionResult`.
- i18n : chaque nouvelle chaîne UI dans **les 5 fichiers** `messages/{en,fr,de,es,zh}.json` (mêmes clés partout — la CI de clés doit rester à zéro écart).
- Secrets (`smtp.password`, `oidc.clientSecret`) : chiffrés avec `encrypt()`/`decrypt()` de `src/lib/crypto.ts` ; **jamais renvoyés au client**.
- Précédence : **DB > env, champ par champ**.
- Vérification finale : `pnpm typecheck && pnpm lint && pnpm test && pnpm build` ; pas d'E2E (l'utilisateur teste manuellement).
- Commits : petits, préfixés `feat(config):` / `refactor(auth):` etc.

---

### Task 1: Résolveur pur env/DB — `src/lib/config/resolve.ts`

**Files:**
- Create: `src/lib/config/resolve.ts`
- Test: `src/lib/config/resolve.test.ts`

**Interfaces:**
- Produces:
  - `interface SmtpConfig { host: string; port: number; secure: boolean; user: string | null; password: string | null; from: string }`
  - `interface OidcConfig { discoveryUrl: string; clientId: string; clientSecret: string; providerLabel: string; scopes: string; groupsClaim: string }`
  - `type Provenance = "db" | "env" | "unset"`
  - `resolveSmtpConfig(db: Partial<Record<SmtpField, string>>, envDefaults: SmtpEnvDefaults): SmtpConfig | null`
  - `resolveOidcConfig(db: Partial<Record<OidcField, string>>, envDefaults: OidcEnvDefaults): OidcConfig | null`
  - `fieldProvenance(dbValue: string | undefined, envValue: string | undefined): Provenance`
  - Constantes `SMTP_FIELDS = ["host","port","secure","user","password","from"] as const`, `OIDC_FIELDS = ["discoveryUrl","clientId","clientSecret","providerLabel","scopes","groupsClaim"] as const`

Le module est **pur** (pas de `server-only`, pas de Prisma, pas de `lib/env`) : la DB et l'env lui sont passées en paramètres — c'est ce qui le rend testable et ce que `index.ts` (Task 2) branchera sur le vrai monde.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// src/lib/config/resolve.test.ts
import { describe, expect, it } from "vitest";
import {
  fieldProvenance,
  resolveOidcConfig,
  resolveSmtpConfig,
} from "./resolve";

const smtpEnv = {
  host: "mail.env.example",
  port: 587,
  secure: false,
  user: undefined,
  password: undefined,
  from: "Env <env@example.com>",
};

describe("resolveSmtpConfig", () => {
  it("returns env values when no DB override exists", () => {
    expect(resolveSmtpConfig({}, smtpEnv)).toEqual({
      host: "mail.env.example",
      port: 587,
      secure: false,
      user: null,
      password: null,
      from: "Env <env@example.com>",
    });
  });

  it("overrides field by field — DB wins only where set", () => {
    const config = resolveSmtpConfig(
      { host: "mail.db.example", port: "465", secure: "true" },
      smtpEnv,
    );
    expect(config).toMatchObject({
      host: "mail.db.example",
      port: 465,
      secure: true,
      from: "Env <env@example.com>", // env fallback preserved
    });
  });

  it("is null when neither DB nor env provide host+from", () => {
    expect(
      resolveSmtpConfig({}, { ...smtpEnv, host: undefined }),
    ).toBeNull();
    expect(
      resolveSmtpConfig({ host: "mail.db.example" }, { ...smtpEnv, host: undefined, from: undefined }),
    ).toBeNull();
  });

  it("DB alone is enough (no env at all)", () => {
    const config = resolveSmtpConfig(
      { host: "db.example", from: "DB <db@example.com>" },
      { host: undefined, port: 587, secure: false, user: undefined, password: undefined, from: undefined },
    );
    expect(config).toMatchObject({ host: "db.example", port: 587 });
  });
});

const oidcEnv = {
  discoveryUrl: "https://idp.example/.well-known/openid-configuration",
  clientId: "env-client",
  clientSecret: "env-secret",
  providerLabel: "SSO",
  scopes: "openid profile email groups",
  groupsClaim: "groups",
};

describe("resolveOidcConfig", () => {
  it("returns env trio when DB is empty", () => {
    expect(resolveOidcConfig({}, oidcEnv)).toMatchObject({
      clientId: "env-client",
      providerLabel: "SSO",
    });
  });

  it("null when the resolved trio is incomplete", () => {
    expect(
      resolveOidcConfig({}, { ...oidcEnv, clientSecret: undefined }),
    ).toBeNull();
    // DB completes a partial env
    expect(
      resolveOidcConfig(
        { clientSecret: "db-secret" },
        { ...oidcEnv, clientSecret: undefined },
      ),
    ).toMatchObject({ clientSecret: "db-secret" });
  });
});

describe("fieldProvenance", () => {
  it("classifies db / env / unset", () => {
    expect(fieldProvenance("x", "y")).toBe("db");
    expect(fieldProvenance(undefined, "y")).toBe("env");
    expect(fieldProvenance(undefined, undefined)).toBe("unset");
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm vitest run src/lib/config/resolve.test.ts`
Attendu : FAIL — module `./resolve` introuvable.

- [ ] **Step 3: Implémenter**

```ts
// src/lib/config/resolve.ts
/**
 * Fusion pure des overrides DB (strings de la table Setting) avec les
 * défauts issus de l'environnement. Précédence : DB > env, champ par champ.
 * Aucune I/O ici — index.ts branche ce module sur Prisma et lib/env.
 */

export const SMTP_FIELDS = [
  "host",
  "port",
  "secure",
  "user",
  "password",
  "from",
] as const;
export type SmtpField = (typeof SMTP_FIELDS)[number];

export const OIDC_FIELDS = [
  "discoveryUrl",
  "clientId",
  "clientSecret",
  "providerLabel",
  "scopes",
  "groupsClaim",
] as const;
export type OidcField = (typeof OIDC_FIELDS)[number];

export type Provenance = "db" | "env" | "unset";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  password: string | null;
  from: string;
}

export interface SmtpEnvDefaults {
  host: string | undefined;
  port: number;
  secure: boolean;
  user: string | undefined;
  password: string | undefined;
  from: string | undefined;
}

export interface OidcConfig {
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  providerLabel: string;
  scopes: string;
  groupsClaim: string;
}

export interface OidcEnvDefaults {
  discoveryUrl: string | undefined;
  clientId: string | undefined;
  clientSecret: string | undefined;
  providerLabel: string;
  scopes: string;
  groupsClaim: string;
}

function pick(db: string | undefined, env: string | undefined): string | null {
  return db !== undefined && db !== "" ? db : (env ?? null);
}

export function fieldProvenance(
  dbValue: string | undefined,
  envValue: string | undefined,
): Provenance {
  if (dbValue !== undefined && dbValue !== "") return "db";
  if (envValue !== undefined && envValue !== "") return "env";
  return "unset";
}

/** null quand ni la DB ni l'env ne fournissent host + from (règle smtpEnabled). */
export function resolveSmtpConfig(
  db: Partial<Record<SmtpField, string>>,
  envDefaults: SmtpEnvDefaults,
): SmtpConfig | null {
  const host = pick(db.host, envDefaults.host);
  const from = pick(db.from, envDefaults.from);
  if (!host || !from) return null;
  return {
    host,
    from,
    port: db.port !== undefined ? Number(db.port) : envDefaults.port,
    secure:
      db.secure !== undefined ? db.secure === "true" : envDefaults.secure,
    user: pick(db.user, envDefaults.user),
    password: pick(db.password, envDefaults.password),
  };
}

/** null quand le trio discoveryUrl/clientId/clientSecret résolu est incomplet. */
export function resolveOidcConfig(
  db: Partial<Record<OidcField, string>>,
  envDefaults: OidcEnvDefaults,
): OidcConfig | null {
  const discoveryUrl = pick(db.discoveryUrl, envDefaults.discoveryUrl);
  const clientId = pick(db.clientId, envDefaults.clientId);
  const clientSecret = pick(db.clientSecret, envDefaults.clientSecret);
  if (!discoveryUrl || !clientId || !clientSecret) return null;
  return {
    discoveryUrl,
    clientId,
    clientSecret,
    providerLabel: pick(db.providerLabel, envDefaults.providerLabel) ?? "SSO",
    scopes:
      pick(db.scopes, envDefaults.scopes) ?? "openid profile email groups",
    groupsClaim: pick(db.groupsClaim, envDefaults.groupsClaim) ?? "groups",
  };
}
```

- [ ] **Step 4: Vérifier le vert**

Run: `pnpm vitest run src/lib/config/resolve.test.ts`
Attendu : PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/config/resolve.ts src/lib/config/resolve.test.ts
git commit -m "feat(config): pure env/DB resolver for runtime SMTP/OIDC config"
```

---

### Task 2: DAL Setting + façade `src/lib/config/index.ts`

**Files:**
- Modify: `src/lib/dal/settings.ts` (ajouter une section « runtime config » en fin de fichier)
- Create: `src/lib/config/index.ts`

**Interfaces:**
- Consumes: Task 1 (`resolveSmtpConfig`, `resolveOidcConfig`, `fieldProvenance`, `SMTP_FIELDS`, `OIDC_FIELDS`).
- Produces (DAL) :
  - `getConfigOverrides(prefix: "smtp" | "oidc"): Promise<Record<string, string>>` — clés sans le préfixe (ex. `host`), secrets **déchiffrés**.
  - `setConfigOverrides(prefix, values: Record<string, string | null>): Promise<void>` — `null` supprime la clé ; upsert + `bumpConfigVersion` dans une seule transaction ; chiffre `smtp.password` / `oidc.clientSecret`.
  - `clearConfigOverrides(prefix): Promise<void>` — deleteMany + bump, une transaction.
  - `getConfigVersion(): Promise<number>` — 0 si absent.
- Produces (façade `src/lib/config/index.ts`) :
  - `getSmtpConfig(): Promise<SmtpConfig | null>`
  - `getOidcConfig(): Promise<OidcConfig | null>`
  - `isSmtpConfigured(): Promise<boolean>` / `isOidcConfigured(): Promise<boolean>`
  - `getSmtpProvenance(): Promise<Record<SmtpField, Provenance>>` / `getOidcProvenance(): Promise<Record<OidcField, Provenance>>`
  - Ré-exporte les types `SmtpConfig`, `OidcConfig`, `Provenance`, `SmtpField`, `OidcField`.

Pas de test unitaire ici (accès Prisma — la logique testable vit en Task 1). Clés DB : `smtp.host` … `oidc.groupsClaim`, `configVersion`. Secrets chiffrés à l'écriture (`encrypt`), déchiffrés à la lecture (`decrypt`) dans le DAL — la façade ne voit que du clair.

- [ ] **Step 1: Étendre `src/lib/dal/settings.ts`**

```ts
// --- runtime config (SMTP / OIDC overrides + version) ---

import { decrypt, encrypt } from "@/lib/crypto"; // (en tête de fichier)

const CONFIG_VERSION_KEY = "configVersion";
const SECRET_KEYS = new Set(["smtp.password", "oidc.clientSecret"]);

export async function getConfigVersion(): Promise<number> {
  const row = await prisma.setting.findUnique({
    where: { key: CONFIG_VERSION_KEY },
    select: { value: true },
  });
  return row ? Number(row.value) : 0;
}

function bumpConfigVersion(current: number): Prisma.PrismaPromise<unknown> {
  return prisma.setting.upsert({
    where: { key: CONFIG_VERSION_KEY },
    create: { key: CONFIG_VERSION_KEY, value: String(current + 1) },
    update: { value: String(current + 1) },
  });
}

/** Overrides DB d'un groupe, clés sans préfixe, secrets déchiffrés. */
export async function getConfigOverrides(
  prefix: "smtp" | "oidc",
): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: `${prefix}.` } },
    select: { key: true, value: true },
  });
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.key === CONFIG_VERSION_KEY) continue;
    const field = row.key.slice(prefix.length + 1);
    result[field] = SECRET_KEYS.has(row.key) ? decrypt(row.value) : row.value;
  }
  return result;
}

/** null supprime la clé ; le tout + bump de version en une transaction. */
export async function setConfigOverrides(
  prefix: "smtp" | "oidc",
  values: Record<string, string | null>,
): Promise<void> {
  const version = await getConfigVersion();
  const operations: Prisma.PrismaPromise<unknown>[] = [];
  for (const [field, value] of Object.entries(values)) {
    const key = `${prefix}.${field}`;
    if (value === null) {
      operations.push(deleteSettings([key]));
    } else {
      const stored = SECRET_KEYS.has(key) ? encrypt(value) : value;
      operations.push(setStringSetting(key, stored));
    }
  }
  operations.push(bumpConfigVersion(version));
  await prisma.$transaction(operations);
}

export async function clearConfigOverrides(
  prefix: "smtp" | "oidc",
): Promise<void> {
  const version = await getConfigVersion();
  await prisma.$transaction([
    prisma.setting.deleteMany({ where: { key: { startsWith: `${prefix}.` } } }),
    bumpConfigVersion(version),
  ]);
}
```

- [ ] **Step 2: Créer la façade `src/lib/config/index.ts`**

```ts
import "server-only";
import { getConfigOverrides } from "@/lib/dal/settings";
import { env } from "@/lib/env";
import {
  fieldProvenance,
  OIDC_FIELDS,
  type OidcConfig,
  type OidcField,
  type Provenance,
  resolveOidcConfig,
  resolveSmtpConfig,
  SMTP_FIELDS,
  type SmtpConfig,
  type SmtpField,
} from "./resolve";

export type {
  OidcConfig,
  OidcField,
  Provenance,
  SmtpConfig,
  SmtpField,
};
export { OIDC_FIELDS, SMTP_FIELDS };

function smtpEnvDefaults() {
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
  };
}

function oidcEnvDefaults() {
  return {
    discoveryUrl: env.OIDC_DISCOVERY_URL,
    clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET,
    providerLabel: env.OIDC_PROVIDER_LABEL,
    scopes: env.OIDC_SCOPES,
    groupsClaim: env.OIDC_GROUPS_CLAIM,
  };
}

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  return resolveSmtpConfig(await getConfigOverrides("smtp"), smtpEnvDefaults());
}

export async function getOidcConfig(): Promise<OidcConfig | null> {
  return resolveOidcConfig(await getConfigOverrides("oidc"), oidcEnvDefaults());
}

export async function isSmtpConfigured(): Promise<boolean> {
  return (await getSmtpConfig()) !== null;
}

export async function isOidcConfigured(): Promise<boolean> {
  return (await getOidcConfig()) !== null;
}

/** Par champ : la valeur effective vient-elle de la DB, de l'env, ou de nulle part ? */
export async function getSmtpProvenance(): Promise<
  Record<SmtpField, Provenance>
> {
  const db = await getConfigOverrides("smtp");
  const defaults = smtpEnvDefaults();
  return Object.fromEntries(
    SMTP_FIELDS.map((field) => [
      field,
      fieldProvenance(
        db[field],
        defaults[field] === undefined ? undefined : String(defaults[field]),
      ),
    ]),
  ) as Record<SmtpField, Provenance>;
}

export async function getOidcProvenance(): Promise<
  Record<OidcField, Provenance>
> {
  const db = await getConfigOverrides("oidc");
  const defaults = oidcEnvDefaults();
  return Object.fromEntries(
    OIDC_FIELDS.map((field) => [
      field,
      fieldProvenance(db[field], defaults[field]),
    ]),
  ) as Record<OidcField, Provenance>;
}
```

- [ ] **Step 3: Vérifier**

Run: `pnpm typecheck && pnpm lint`
Attendu : PASS (aucun consommateur encore, mais types et imports valides).

- [ ] **Step 4: Commit**

```bash
git add src/lib/dal/settings.ts src/lib/config/index.ts
git commit -m "feat(config): Setting-backed overrides with encrypted secrets + config facade"
```

---

### Task 3: mail.ts dynamique + call sites `smtpEnabled`/`oidcEnabled`

**Files:**
- Modify: `src/lib/mail.ts` (transporteur par envoi, config résolue)
- Modify: `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-up/page.tsx`, `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/reset-password/page.tsx`
- Modify: `src/app/(app)/admin/settings/page.tsx` (remplace `oidcEnabled()` par `isOidcConfigured()`)
- Modify: `src/features/admin/actions.ts` (garde OIDC-only sur config résolue)

**Interfaces:**
- Consumes: `getSmtpConfig`, `getOidcConfig`, `isSmtpConfigured`, `isOidcConfigured` (Task 2).
- Produces: `sendMail` / `sendPasswordResetEmail` inchangés en signature ; les pages `(auth)` n'importent plus `smtpEnabled`/`oidcEnabled` de `lib/env`.

- [ ] **Step 1: Réécrire `src/lib/mail.ts`**

Le cache `globalThis.mailer` disparaît (la config peut changer entre deux envois) — nodemailer recrée un transport léger par envoi, acceptable pour le volume d'emails d'admin.

```ts
import "server-only";
import nodemailer from "nodemailer";
import { getSmtpConfig } from "@/lib/config";

/** Plain-text email through the configured relay. Throws if SMTP is unset. */
export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const config = await getSmtpConfig();
  if (!config) {
    throw new Error("SMTP is not configured.");
  }
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user
      ? { user: config.user, pass: config.password ?? undefined }
      : undefined,
  });
  await transporter.sendMail({ from: config.from, ...input });
}

export async function sendPasswordResetEmail(
  to: string,
  url: string,
): Promise<void> {
  await sendMail({
    to,
    subject: "Reset your password",
    text: [
      "Someone asked to reset the password of your account.",
      "",
      `Reset it here (the link expires in 1 hour): ${url}`,
      "",
      "If it wasn't you, you can ignore this email — nothing changed.",
    ].join("\n"),
  });
}
```

- [ ] **Step 2: Adapter les pages `(auth)` et la garde admin**

Dans chaque page, remplacer l'import `env`/`smtpEnabled`/`oidcEnabled` par la façade et `await` :

```ts
// sign-in/page.tsx — avant :
//   import { env, oidcEnabled, smtpEnabled } from "@/lib/env";
//   oidcLabel={oidcEnabled() ? env.OIDC_PROVIDER_LABEL : null}
//   showForgotLink={smtpEnabled() && !oidcOnly}
import { getOidcConfig, isSmtpConfigured } from "@/lib/config";
// dans le composant (RSC async) :
const [oidc, smtpConfigured] = await Promise.all([
  getOidcConfig(),
  isSmtpConfigured(),
]);
// oidcLabel={oidc ? oidc.providerLabel : null}
// showForgotLink={smtpConfigured && !oidcOnly}
```

Même transformation :
- `sign-up/page.tsx` : `oidcLabel={oidc ? oidc.providerLabel : null}`.
- `forgot-password/page.tsx` et `reset-password/page.tsx` : `if (!(await isSmtpConfigured()) || (await isOidcOnly())) redirect("/sign-in");`
- `admin/settings/page.tsx` : `oidcConfigured={await isOidcConfigured()}` (l'ajouter au `Promise.all` existant).
- `features/admin/actions.ts` (`setOidcOnlyEnabled`) : `if (enabled === true && !(await isOidcConfigured()))` — import depuis `@/lib/config`, supprimer l'import `oidcEnabled`.

`smtpEnabled`/`oidcEnabled`/`assertSmtpEnv`/`assertOidcEnv` restent dans `lib/env.ts` : les asserts de boot gardent leur rôle (env partielle = erreur de déploiement) ; `smtpEnabled` reste utilisé par `auth.ts` jusqu'à la Task 4 qui l'en retire.

- [ ] **Step 3: Vérifier**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Attendu : PASS. `git grep -n "smtpEnabled\|oidcEnabled" src/app` ne doit plus rien retourner.

- [ ] **Step 4: Commit**

```bash
git add src/lib/mail.ts "src/app/(auth)" "src/app/(app)/admin/settings/page.tsx" src/features/admin/actions.ts
git commit -m "feat(config): resolve SMTP/OIDC availability from DB+env at request time"
```

---

### Task 4: `getAuth()` versionnée + migration des call sites

**Files:**
- Modify: `src/lib/auth/auth.ts` (singleton → fabrique versionnée)
- Modify: `src/lib/auth/oidc.ts` (`buildOidcProvider(config: OidcConfig)`)
- Modify: `src/lib/auth/session.ts`, `src/app/api/auth/[...all]/route.ts`, `src/app/(app)/account/page.tsx`, `src/features/admin/actions.ts`
- Test: `src/lib/auth/auth-cache.test.ts`

**Interfaces:**
- Consumes: `getOidcConfig` (Task 2), `getConfigVersion` (DAL, Task 2).
- Produces:
  - `getAuth(): Promise<Auth>` avec `type Auth = ReturnType<typeof buildAuth>` — remplace l'export `auth`.
  - Helper pur exporté pour le test : `shouldRefresh(cache: { version: number; checkedAt: number } | null, dbVersion: number | null, now: number, ttlMs: number): boolean` — extrait la décision de rafraîchissement (null dbVersion = TTL non expiré, pas de lecture DB).
  - `oidc.ts` : `buildOidcProvider(config: OidcConfig): OidcProviderConfig` (plus de lecture d'env, plus de retour null).

- [ ] **Step 1: Test du helper de cache (échec d'abord)**

```ts
// src/lib/auth/auth-cache.test.ts
import { describe, expect, it } from "vitest";
import { shouldRefresh } from "./auth";

describe("shouldRefresh", () => {
  it("no cache yet → refresh", () => {
    expect(shouldRefresh(null, 0, 1_000, 5_000)).toBe(true);
  });
  it("TTL not expired → keep instance without DB read", () => {
    expect(
      shouldRefresh({ version: 1, checkedAt: 1_000 }, null, 3_000, 5_000),
    ).toBe(false);
  });
  it("TTL expired, same version → keep", () => {
    expect(
      shouldRefresh({ version: 1, checkedAt: 1_000 }, 1, 7_000, 5_000),
    ).toBe(false);
  });
  it("TTL expired, version bumped → rebuild", () => {
    expect(
      shouldRefresh({ version: 1, checkedAt: 1_000 }, 2, 7_000, 5_000),
    ).toBe(true);
  });
});
```

Run: `pnpm vitest run src/lib/auth/auth-cache.test.ts` → FAIL (`shouldRefresh` non exporté).

Note : ce test importe `./auth` qui porte `"server-only"` — le repo teste déjà des modules server-only (`lib/crypto.test.ts`) grâce à l'alias vitest existant ; si l'import échoue, déplacer `shouldRefresh` dans `src/lib/auth/auth-cache.ts` (pur) importé par `auth.ts`, et tester ce fichier-là.

- [ ] **Step 2: Refactorer `oidc.ts`**

```ts
import "server-only";
import type { genericOAuth } from "better-auth/plugins";
import { normalizeGroupsClaim } from "@/lib/authz/oidc-groups";
import type { OidcConfig } from "@/lib/config";

type OidcProviderConfig = Parameters<typeof genericOAuth>[0]["config"][number];

/** Fixed provider id — the sign-in button and callback URL both use it. */
export const OIDC_PROVIDER_ID = "oidc";

/** Provider générique construit depuis la config résolue (DB > env). */
export function buildOidcProvider(config: OidcConfig): OidcProviderConfig {
  return {
    providerId: OIDC_PROVIDER_ID,
    discoveryUrl: config.discoveryUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    scopes: config.scopes.split(" ").filter(Boolean),
    overrideUserInfo: true,
    mapProfileToUser: (profile) =>
      ({
        oidcGroups: normalizeGroupsClaim(profile[config.groupsClaim]),
      }) as unknown as ReturnType<
        NonNullable<OidcProviderConfig["mapProfileToUser"]>
      >,
  };
}
```

- [ ] **Step 3: Refactorer `auth.ts`**

Le corps de `betterAuth({...})` existant (rate limits, hooks, databaseHooks, plugin admin, `nextCookies` en dernier) part tel quel dans `buildAuth(oidcConfig)`. Changements :

```ts
// En tête : plus d'import smtpEnabled ; ajouter :
import { getOidcConfig, type OidcConfig } from "@/lib/config";
import { getConfigVersion } from "@/lib/dal/settings";

function buildAuth(oidcConfig: OidcConfig | null) {
  return betterAuth({
    /* ...tout le corps actuel inchangé, sauf : */
    emailAndPassword: {
      enabled: true,
      // Toujours branché : sendMail jette si SMTP n'est pas configuré, et le
      // lien "Forgot password?" est masqué côté UI quand SMTP est absent.
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetEmail(user.email, url);
      },
    },
    plugins: [
      admin(),
      ...(oidcConfig
        ? [genericOAuth({ config: [buildOidcProvider(oidcConfig)] })]
        : []),
      nextCookies(), // must stay last so server actions can set cookies
    ],
  });
}

export type Auth = ReturnType<typeof buildAuth>;

const VERSION_TTL_MS = 5_000;

/** Décision pure de rafraîchissement — testée dans auth-cache.test.ts. */
export function shouldRefresh(
  cache: { version: number; checkedAt: number } | null,
  dbVersion: number | null,
  now: number,
  ttlMs: number,
): boolean {
  if (!cache) return true;
  if (now - cache.checkedAt < ttlMs) return false;
  return dbVersion !== null && dbVersion !== cache.version;
}

// Sur globalThis, comme le client Prisma : survit au HMR de Turbopack.
const globalForAuth = globalThis as unknown as {
  authCache?: { instance: Auth; version: number; checkedAt: number };
};

/**
 * Instance better-auth reconstruite quand la config SMTP/OIDC change
 * (clé Setting `configVersion`, vérifiée au plus toutes les 5 s).
 */
export async function getAuth(): Promise<Auth> {
  const cache = globalForAuth.authCache ?? null;
  const now = Date.now();
  if (cache && now - cache.checkedAt < VERSION_TTL_MS) return cache.instance;
  const dbVersion = await getConfigVersion();
  if (cache && !shouldRefresh(cache, dbVersion, now, VERSION_TTL_MS)) {
    cache.checkedAt = now;
    return cache.instance;
  }
  const instance = buildAuth(await getOidcConfig());
  globalForAuth.authCache = { instance, version: dbVersion, checkedAt: now };
  return instance;
}
```

Supprimer `const oidcProvider = buildOidcProvider();` (ligne 15 actuelle) et l'`export const auth`.

- [ ] **Step 4: Migrer les call sites**

```ts
// src/lib/auth/session.ts
import { getAuth } from "./auth";
export const getSession = cache(async () =>
  (await getAuth()).api.getSession({ headers: await headers() }),
);

// src/app/api/auth/[...all]/route.ts — toNextJsHandler attend l'instance ;
// chaque handler la résout au moment de la requête :
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/auth";
export async function GET(request: Request) {
  return toNextJsHandler(await getAuth()).GET(request);
}
export async function POST(request: Request) {
  return toNextJsHandler(await getAuth()).POST(request);
}
```

Dans `src/app/(app)/account/page.tsx` et `src/features/admin/actions.ts` : remplacer `import { auth }` par `import { getAuth }` et chaque `auth.api.X({...})` par :

```ts
const auth = await getAuth();
await auth.api.X({ ... });
```

(Une ligne `const auth = await getAuth();` en tête du callback `withAdmin` de chaque action concernée : `createUser`, `setUserRole`, `banUser`, `unbanUser`, `removeUser`.)

- [ ] **Step 5: Vérifier**

Run: `pnpm vitest run src/lib/auth/auth-cache.test.ts` → PASS.
Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → PASS.
`git grep -n "import { auth }" src/` → aucun résultat.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth src/app/api/auth src/app/(app)/account/page.tsx src/features/admin/actions.ts
git commit -m "refactor(auth): versioned getAuth() factory — hot-reloads OIDC config"
```

---

### Task 5: Schémas zod + server actions SMTP/OIDC

**Files:**
- Modify: `src/features/admin/lib/schema.ts` (ajout section « runtime config »)
- Modify: `src/features/admin/actions.ts` (5 nouvelles actions)
- Test: étendre `src/features/admin/lib/schema.test.ts` (le fichier existe — même dossier ; s'il n'existe pas, le créer)

**Interfaces:**
- Consumes: `setConfigOverrides`, `clearConfigOverrides` (Task 2), `getSmtpConfig` (Task 2), `sendMail` (Task 3).
- Produces:
  - `smtpSettingsSchema` / `SmtpSettingsValues` : `{ host: string; port: number; secure: boolean; user: string | null; password: string | null; from: string }` — `password: null` signifie « conserver le secret actuel » (write-only côté UI).
  - `oidcSettingsSchema` / `OidcSettingsValues` : `{ discoveryUrl: string; clientId: string; clientSecret: string | null; providerLabel: string; scopes: string; groupsClaim: string }` — `clientSecret: null` = conserver.
  - Actions : `updateSmtpSettings(input)`, `resetSmtpSettings()`, `updateOidcSettings(input)`, `resetOidcSettings()`, `sendTestEmail()` — toutes `Promise<ActionResult>`.

- [ ] **Step 1: Tests des schémas (échec d'abord)**

```ts
// dans src/features/admin/lib/schema.test.ts (ou nouveau fichier)
import { describe, expect, it } from "vitest";
import { oidcSettingsSchema, smtpSettingsSchema } from "./schema";

describe("smtpSettingsSchema", () => {
  it("accepts a full config, password optional (null = keep current)", () => {
    expect(
      smtpSettingsSchema.safeParse({
        host: "mail.example.com",
        port: 587,
        secure: false,
        user: "mailer",
        password: null,
        from: "App <app@example.com>",
      }).success,
    ).toBe(true);
  });
  it("rejects out-of-range port and empty host", () => {
    expect(
      smtpSettingsSchema.safeParse({
        host: "",
        port: 70_000,
        secure: false,
        user: null,
        password: null,
        from: "a@b.c",
      }).success,
    ).toBe(false);
  });
});

describe("oidcSettingsSchema", () => {
  it("requires an https discovery URL", () => {
    expect(
      oidcSettingsSchema.safeParse({
        discoveryUrl: "http://insecure.example/.well-known/openid-configuration",
        clientId: "id",
        clientSecret: "secret",
        providerLabel: "SSO",
        scopes: "openid profile",
        groupsClaim: "groups",
      }).success,
    ).toBe(false);
  });
});
```

Run: `pnpm vitest run src/features/admin/lib` → FAIL (schemas absents).

- [ ] **Step 2: Ajouter les schémas dans `schema.ts`**

```ts
// --- runtime config (SMTP / OIDC) ---

export const smtpSettingsSchema = z.object({
  host: z.string().trim().min(1, "SMTP host is required.").max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().trim().max(255).nullable(),
  // null → keep the currently stored secret (write-only field).
  password: z.string().min(1).max(1024).nullable(),
  from: z.string().trim().min(3, "Sender address is required.").max(320),
});
export type SmtpSettingsValues = z.infer<typeof smtpSettingsSchema>;

export const oidcSettingsSchema = z.object({
  discoveryUrl: z
    .url("Enter the full discovery URL.")
    .startsWith("https://", "The discovery URL must use https."),
  clientId: z.string().trim().min(1, "Client ID is required.").max(255),
  // null → keep the currently stored secret (write-only field).
  clientSecret: z.string().min(1).max(1024).nullable(),
  providerLabel: z.string().trim().min(1).max(64),
  scopes: z.string().trim().min(1).max(255),
  groupsClaim: z.string().trim().min(1).max(64),
});
export type OidcSettingsValues = z.infer<typeof oidcSettingsSchema>;
```

- [ ] **Step 3: Vérifier le vert des schémas**

Run: `pnpm vitest run src/features/admin/lib` → PASS.

- [ ] **Step 4: Ajouter les actions dans `src/features/admin/actions.ts`**

```ts
// imports additionnels :
import {
  clearConfigOverrides,
  setConfigOverrides,
} from "@/lib/dal/settings";
import { getSmtpConfig } from "@/lib/config";
import { sendMail } from "@/lib/mail";
import {
  type OidcSettingsValues,
  oidcSettingsSchema,
  type SmtpSettingsValues,
  smtpSettingsSchema,
} from "@/features/admin/lib/schema";

// --- runtime config (SMTP / OIDC) ---

export async function updateSmtpSettings(
  input: SmtpSettingsValues,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    { action: "update smtp settings", failureMessage: t("settingUpdateFailed") },
    async () => {
      const parsed = smtpSettingsSchema.safeParse(input);
      if (!parsed.success) {
        return actionError(parsed.error.issues[0]?.message ?? t("invalidInput"));
      }
      const { host, port, secure, user, password, from } = parsed.data;
      await setConfigOverrides("smtp", {
        host,
        port: String(port),
        secure: String(secure),
        user: user || null,
        // null = conserver le secret déjà stocké — on n'écrit pas la clé.
        ...(password !== null ? { password } : {}),
        from,
      });
      return actionOk();
    },
  );
}

export async function resetSmtpSettings(): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    { action: "reset smtp settings", failureMessage: t("settingUpdateFailed") },
    async () => {
      await clearConfigOverrides("smtp");
      return actionOk();
    },
  );
}

export async function updateOidcSettings(
  input: OidcSettingsValues,
): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    { action: "update oidc settings", failureMessage: t("settingUpdateFailed") },
    async () => {
      const parsed = oidcSettingsSchema.safeParse(input);
      if (!parsed.success) {
        return actionError(parsed.error.issues[0]?.message ?? t("invalidInput"));
      }
      // Le discovery document doit répondre — une config cassée ne rentre pas.
      try {
        const response = await fetch(parsed.data.discoveryUrl, {
          signal: AbortSignal.timeout(5_000),
        });
        const doc = (await response.json()) as {
          authorization_endpoint?: unknown;
        };
        if (!response.ok || typeof doc.authorization_endpoint !== "string") {
          return actionError(t("oidcDiscoveryFailed"));
        }
      } catch {
        return actionError(t("oidcDiscoveryFailed"));
      }
      const { discoveryUrl, clientId, clientSecret, providerLabel, scopes, groupsClaim } =
        parsed.data;
      await setConfigOverrides("oidc", {
        discoveryUrl,
        clientId,
        ...(clientSecret !== null ? { clientSecret } : {}),
        providerLabel,
        scopes,
        groupsClaim,
      });
      return actionOk();
    },
  );
}

export async function resetOidcSettings(): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    { action: "reset oidc settings", failureMessage: t("settingUpdateFailed") },
    async () => {
      await clearConfigOverrides("oidc");
      return actionOk();
    },
  );
}

/** Envoie un email de test à l'admin connecté via la config effective. */
export async function sendTestEmail(): Promise<ActionResult> {
  const t = await getTranslations("admin.errors");
  return withAdmin(
    {
      action: "send test email",
      failureMessage: t("testEmailFailed"),
      revalidate: false,
    },
    async (admin) => {
      if (!(await getSmtpConfig())) {
        return actionError(t("smtpNotConfigured"));
      }
      const tMail = await getTranslations("admin.runtimeConfig");
      await sendMail({
        to: admin.email,
        subject: tMail("testEmailSubject"),
        text: tMail("testEmailBody"),
      });
      return actionOk();
    },
  );
}
```

Note importante : garder la sémantique « password null = conserver » cohérente avec le reset : pour retirer *seulement* le mot de passe, l'admin passe par « Rétablir les valeurs d'environnement ». `user: user || null` supprime l'override user quand le champ est vidé.

- [ ] **Step 5: Vérifier**

Run: `pnpm typecheck && pnpm lint && pnpm test` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/lib src/features/admin/actions.ts
git commit -m "feat(admin): SMTP/OIDC settings actions with discovery check and test email"
```

---

### Task 6: Cartes UI Admin → Settings

**Files:**
- Create: `src/features/admin/components/smtp-settings-form.tsx`
- Create: `src/features/admin/components/oidc-settings-form.tsx`
- Create: `src/features/admin/components/provenance-badge.tsx`
- Modify: `src/app/(app)/admin/settings/page.tsx`

**Interfaces:**
- Consumes: actions Task 5 ; `getSmtpConfig`, `getOidcConfig`, `getSmtpProvenance`, `getOidcProvenance` (Task 2) ; kit `useAppForm` (`src/forms/`) ; composants Card/Button existants (mêmes imports que `branding-form.tsx`).
- Produces: composants client `SmtpSettingsForm` / `OidcSettingsForm` avec props sérialisables **sans secrets** :
  - `SmtpSettingsForm({ initial: { host, port, secure, user, from } | null, hasPassword: boolean, provenance: Record<SmtpField, Provenance> })`
  - `OidcSettingsForm({ initial: { discoveryUrl, clientId, providerLabel, scopes, groupsClaim } | null, hasSecret: boolean, provenance: Record<OidcField, Provenance>, callbackUrl: string })`

**IMPORTANT pour l'implémenteur :** avant d'écrire ces composants, lire `src/features/admin/components/branding-form.tsx` et `settings-form.tsx` pour copier exactement le pattern du repo (useAppForm, soumission, toasts, Card, i18n `useTranslations`). Le squelette ci-dessous fixe le contrat et la structure ; le style et les helpers de formulaire doivent suivre l'existant, pas être réinventés.

- [ ] **Step 1: `provenance-badge.tsx`**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { Provenance } from "@/lib/config/resolve";

/** Petit badge « env » / « personnalisé » à côté du label d'un champ. */
export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const t = useTranslations("admin.runtimeConfig.provenance");
  if (provenance === "unset") return null;
  return (
    <Badge variant={provenance === "db" ? "default" : "outline"}>
      {provenance === "db" ? t("custom") : t("env")}
    </Badge>
  );
}
```

(Import de `Provenance` depuis `@/lib/config/resolve` — le module pur, importable côté client — et non `@/lib/config` qui est server-only.)

- [ ] **Step 2: `smtp-settings-form.tsx`**

Structure (à caler sur le pattern de `branding-form.tsx`) :

- Carte avec titre `t("smtp.title")`, description `t("smtp.description")`.
- `useAppForm` avec valeurs initiales `{ host, port, secure, user: user ?? "", password: "", from }` (depuis `initial`, chaînes vides si null).
- Champs : host (Input), port (Input number), secure (Switch), user (Input), password (Input type="password", placeholder `hasPassword ? t("smtp.passwordSet") : t("smtp.passwordUnset")`), from (Input). Chaque label accompagné de `<ProvenanceBadge provenance={provenance.<field>} />`.
- Submit → `updateSmtpSettings({ ...values, port: Number(values.port), user: values.user || null, password: values.password === "" ? null : values.password })` ; toast succès/erreur comme branding-form ; `router.refresh()` après succès.
- Bouton secondaire « Rétablir les valeurs d'environnement » → `resetSmtpSettings()` derrière le `ConfirmDialog` du repo, puis `router.refresh()`.
- Bouton « Envoyer un email de test » → `sendTestEmail()` ; toast avec le message d'erreur SMTP réel en cas d'échec ; désactivé pendant l'envoi.

- [ ] **Step 3: `oidc-settings-form.tsx`**

Même squelette. Spécificités :

- Champs : discoveryUrl, clientId, clientSecret (write-only, même pattern placeholder), providerLabel, scopes, groupsClaim — badges de provenance partout.
- Encadré informatif (composant `Alert` ou équivalent du repo) affichant l'URL de callback à déclarer chez l'IdP : la prop `callbackUrl` (`${env.BETTER_AUTH_URL}/api/auth/oauth2/callback/oidc`, construite côté serveur dans la page).
- Second encadré d'avertissement : tester la connexion SSO dans une fenêtre privée avant d'activer « OIDC only » (`t("oidc.lockoutWarning")`).
- Submit → `updateOidcSettings({ ...values, clientSecret: values.clientSecret === "" ? null : values.clientSecret })`.

- [ ] **Step 4: Brancher la page settings**

```tsx
// src/app/(app)/admin/settings/page.tsx — ajouts au Promise.all :
const [signUpEnabled, oidcOnly, sharingEnabled, branding, smtp, oidc, smtpProvenance, oidcProvenance] =
  await Promise.all([
    isPublicSignUpEnabled(),
    isOidcOnly(),
    isPublicSharingEnabled(),
    getBranding(),
    getSmtpConfig(),
    getOidcConfig(),
    getSmtpProvenance(),
    getOidcProvenance(),
  ]);
// oidcConfigured={oidc !== null} (remplace l'appel oidcEnabled() retiré en Task 3)

// Sous <BrandingForm …/> :
<SmtpSettingsForm
  initial={
    smtp
      ? { host: smtp.host, port: smtp.port, secure: smtp.secure, user: smtp.user, from: smtp.from }
      : null
  }
  hasPassword={smtp?.password != null}
  provenance={smtpProvenance}
/>
<OidcSettingsForm
  initial={
    oidc
      ? {
          discoveryUrl: oidc.discoveryUrl,
          clientId: oidc.clientId,
          providerLabel: oidc.providerLabel,
          scopes: oidc.scopes,
          groupsClaim: oidc.groupsClaim,
        }
      : null
  }
  hasSecret={oidc !== null}
  provenance={oidcProvenance}
  callbackUrl={`${env.BETTER_AUTH_URL}/api/auth/oauth2/callback/oidc`}
/>
```

Les secrets (`smtp.password`, `oidc.clientSecret`) **ne traversent jamais** la frontière RSC → client : seuls `hasPassword`/`hasSecret` passent.

- [ ] **Step 5: Vérifier**

Run: `pnpm typecheck && pnpm lint` → PASS (les clés i18n manquantes arrivent en Task 7 ; si le lint/type échoue sur les clés, faire Task 7 avant ce step et re-vérifier ici).

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/components src/app/(app)/admin/settings/page.tsx
git commit -m "feat(admin): SMTP and OIDC settings cards with provenance badges"
```

---

### Task 7: i18n — 5 langues

**Files:**
- Modify: `messages/en.json`, `messages/fr.json`, `messages/de.json`, `messages/es.json`, `messages/zh.json`

**Interfaces:**
- Consumes: les clés référencées par Tasks 5-6.
- Produces: bloc `admin.runtimeConfig` + clés `admin.errors` supplémentaires, **identiques dans les 5 fichiers**.

- [ ] **Step 1: Ajouter les clés (contenu en anglais ci-dessous ; traduire fidèlement en fr/de/es/zh — pas de copier-coller de l'anglais dans les autres langues)**

Dans `admin.errors` :

```json
{
  "oidcDiscoveryFailed": "The discovery URL did not answer with a valid OpenID configuration.",
  "smtpNotConfigured": "SMTP is not configured.",
  "testEmailFailed": "The test email could not be sent."
}
```

Nouveau bloc `admin.runtimeConfig` :

```json
{
  "provenance": { "env": "env", "custom": "custom" },
  "resetToEnv": "Restore environment values",
  "resetConfirm": "This removes every value saved here and falls back to the environment variables. Continue?",
  "saved": "Settings saved.",
  "testEmailSubject": "Test email",
  "testEmailBody": "This email confirms your SMTP settings work.",
  "smtp": {
    "title": "Email (SMTP)",
    "description": "Relay used for password-reset and account emails. Environment variables provide the defaults; values saved here override them.",
    "host": "Host",
    "port": "Port",
    "secure": "TLS (implicit)",
    "user": "Username",
    "password": "Password",
    "passwordSet": "•••• (configured — type to replace)",
    "passwordUnset": "Not set",
    "from": "Sender",
    "sendTest": "Send a test email",
    "testSent": "Test email sent to {email}."
  },
  "oidc": {
    "title": "Single Sign-On (OIDC)",
    "description": "Generic OpenID Connect provider. Environment variables provide the defaults; values saved here override them.",
    "discoveryUrl": "Discovery URL",
    "clientId": "Client ID",
    "clientSecret": "Client secret",
    "secretSet": "•••• (configured — type to replace)",
    "secretUnset": "Not set",
    "providerLabel": "Sign-in button label",
    "scopes": "Scopes",
    "groupsClaim": "Groups claim",
    "callbackInfo": "Register this callback URL with your identity provider:",
    "lockoutWarning": "Before enabling “OIDC only”, verify the SSO sign-in works in a private window — a broken OIDC config with password sign-in disabled locks everyone out."
  }
}
```

- [ ] **Step 2: Vérifier la parité des clés**

Run: `pnpm test` (la suite i18n du repo compare les clés) puis `pnpm typecheck && pnpm lint` → PASS.

- [ ] **Step 3: Commit**

```bash
git add messages
git commit -m "feat(i18n): runtime SMTP/OIDC config strings in all five locales"
```

---

### Task 8: Vérification finale

**Files:** aucun nouveau — passe de vérification.

- [ ] **Step 1: Suite complète**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Attendu : tout PASS.

- [ ] **Step 2: Revue croisée spec ↔ code**

Relire `docs/superpowers/specs/2026-07-17-runtime-smtp-oidc-config-design.md` section par section et vérifier chaque exigence (précédence champ par champ, secrets chiffrés jamais renvoyés, TTL 5 s, garde anti-lockout sur config résolue, discovery vérifié à la sauvegarde, badges, reset, email de test, i18n ×5).

- [ ] **Step 3: Commit final éventuel + handoff**

Signaler à l'utilisateur que la branche `feat/runtime-smtp-oidc-config` est prête pour son test manuel (page Admin → Settings) — ne pas lancer d'E2E.
