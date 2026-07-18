# next-safe-action Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer les ~45 server actions du pattern maison (`ActionResult` + `withAdmin`/`withWriteAccess`/guards inline) vers next-safe-action v8, avec validation zod obligatoire et clients middleware pour l'auth.

**Architecture:** Un client de base (`src/lib/safe-action.ts`) avec `ActionError` (message i18n UI-safe), `handleServerError` centralisé (log + message générique ou `failureKey` metadata), et metadata `{ actionName, revalidate?, failureKey? }`. Trois dérivés : `authActionClient` (session), `adminActionClient` (admin + revalidatePath), et un middleware validé `sourceAccessMiddleware` (remplace `withWriteAccess`, contraint sur `parsedInput.sourceId`). Les call sites passent sur la forme native `{ data, serverError, validationErrors }`.

**Tech Stack:** next-safe-action v8 (standard-schema, compatible zod 4), zod ^4.4.3, next-intl (server), Vitest 4, Next.js 16.2.10.

**Spec:** `docs/superpowers/specs/2026-07-18-next-safe-action-design.md` — la lire avant de commencer.

## Global Constraints

- Branche de travail : `feat/next-safe-action` (déjà créée).
- i18n : tout message montré à l'utilisateur passe par next-intl (`getTranslations`), clés dans `messages/en.json` **et** `messages/fr.json`. Réutiliser les clés existantes ; n'en créer que si aucune ne convient.
- Frontières Biome (`noRestrictedImports`) : pas de cross-feature imports ; l'infra partagée vit dans `src/lib/`, le middleware source dans `src/features/browser/server/`.
- Tous les inputs d'action deviennent **un objet unique** validé par un schéma zod via `.inputSchema()`. Plus aucun argument positionnel.
- Chaque action déclare `.metadata({ actionName: "..." })` (format `"<feature>.<fonction>"`, ex. `"admin.createGroup"`).
- Comportements à préserver à l'identique : 404 uniforme (`sourceNotFound`) pour les sources illisibles ; messages denied/failure actuels ; `revalidatePath("/", "layout")` après succès admin (sauf actions marquées `revalidate: false` aujourd'hui) ; délai 500ms sur mauvais mot de passe dans `unlockShare`/`unlockDropLink` ; self-checks admin (`cannotBanSelf`, etc.).
- Vérification par tâche : `pnpm typecheck && pnpm lint && pnpm test`. `pnpm build` uniquement en tâche finale. Pas d'E2E (Lionel teste l'UI manuellement).
- Commits fréquents, un par tâche minimum.

---

### Task 1: Infra de base — `src/lib/safe-action.ts`

**Files:**
- Create: `src/lib/safe-action.ts`
- Create: `src/lib/safe-action.test.ts`
- Modify: `package.json` (dépendance)
- Modify: `messages/en.json`, `messages/fr.json` (clé générique si absente)

**Interfaces:**
- Consumes: `currentUser`, `currentAdmin`, `SessionUser` (`src/lib/auth/session.ts`).
- Produces (les tâches 2–11 en dépendent) :
  - `class ActionError extends Error` — message déjà traduit, UI-safe.
  - `actionClient` — client de base (metadata obligatoire, validation errors flattened).
  - `authActionClient` — `actionClient` + middleware session ; `ctx.user: SessionUser`.
  - `adminActionClient` — `actionClient` + middleware admin ; `ctx.admin: SessionUser` ; `revalidatePath("/", "layout")` après succès sauf `metadata.revalidate === false`.
  - Schéma metadata : `{ actionName: string; revalidate?: boolean; failureKey?: string }` où `failureKey` est une clé i18n complète (ex. `"admin.errors.createGroupFailed"`) utilisée par `handleServerError` à la place du message générique.

- [ ] **Step 1: Installer next-safe-action**

Run: `pnpm add next-safe-action`
Expected: version ^8 dans package.json. Lire ensuite `node_modules/next/dist/docs/` si un doute sur les conventions server actions Next 16 (consigne AGENTS.md).

- [ ] **Step 2: Vérifier/ajouter la clé i18n générique**

Chercher dans `messages/en.json` une clé générique type `browser.errors.actionFailed`. Ajouter sous un namespace commun (ex. `common.actionFailed`) si aucune clé non-feature n'existe : en `"Something went wrong. Please try again."`, fr `"Une erreur est survenue. Veuillez réessayer."` (dans **les deux** fichiers).

- [ ] **Step 3: Écrire les tests qui échouent** (`src/lib/safe-action.test.ts`)

Mocker `next-intl/server` (`getTranslations` → `(ns) => (key) => \`${ns}.${key}\``), `next/cache` (`revalidatePath` spy) et `@/lib/auth/session` (`currentUser`/`currentAdmin` contrôlables). Cas à couvrir :

```ts
import { describe, expect, it, vi } from "vitest";
// mocks vi.mock(...) pour next-intl/server, next/cache, @/lib/auth/session

describe("actionClient error handling", () => {
  it("returns the ActionError message as serverError", async () => {
    const boom = actionClient
      .metadata({ actionName: "test.boom" })
      .inputSchema(z.object({}))
      .action(async () => {
        throw new ActionError("visible message");
      });
    expect((await boom({})).serverError).toBe("visible message");
  });

  it("returns the generic i18n message for unknown errors", async () => { /* throw new Error("db exploded") → serverError === clé générique résolue, jamais "db exploded" */ });
  it("resolves metadata.failureKey for unknown errors when provided", async () => { /* failureKey: "admin.errors.createGroupFailed" → serverError résolu depuis cette clé */ });
  it("returns flattened validationErrors for bad input", async () => { /* input invalide → result.validationErrors défini, pas d'exécution du body */ });
});

describe("adminActionClient", () => {
  it("rejects non-admins with notAuthorized", async () => { /* currentAdmin → null ⇒ serverError = admin.errors.notAuthorized résolu */ });
  it("revalidates the layout after success", async () => { /* revalidatePath appelé avec ("/", "layout") */ });
  it("skips revalidation when metadata.revalidate === false", async () => {});
  it("does not revalidate on failure", async () => {});
});

describe("authActionClient", () => {
  it("rejects anonymous callers", async () => { /* currentUser → null ⇒ serverError défini */ });
});
```

- [ ] **Step 4: Run tests, vérifier l'échec**

Run: `pnpm vitest run src/lib/safe-action.test.ts`
Expected: FAIL — module inexistant.

- [ ] **Step 5: Implémenter `src/lib/safe-action.ts`**

```ts
import "server-only";
import { createSafeActionClient } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { currentAdmin, currentUser } from "@/lib/auth/session";

/** Error whose message is already translated and safe to show in the UI. */
export class ActionError extends Error {}

/** Resolves a full i18n key like "admin.errors.notAuthorized". */
async function resolveKey(key: string): Promise<string> {
  const i = key.lastIndexOf(".");
  const t = await getTranslations(key.slice(0, i));
  return t(key.slice(i + 1));
}

export const actionClient = createSafeActionClient({
  defineMetadataSchema: () =>
    z.object({
      actionName: z.string(),
      revalidate: z.boolean().optional(),
      failureKey: z.string().optional(),
    }),
  defaultValidationErrorsShape: "flattened",
  async handleServerError(e, { metadata }) {
    if (e instanceof ActionError) return e.message;
    console.error(`[${metadata?.actionName ?? "action"}] failed:`, e);
    return resolveKey(metadata?.failureKey ?? "common.actionFailed");
  },
});

export const authActionClient = actionClient.use(async ({ next }) => {
  const user = await currentUser();
  if (!user) {
    const t = await getTranslations("admin.errors");
    throw new ActionError(t("notAuthorized"));
  }
  return next({ ctx: { user } });
});

export const adminActionClient = actionClient.use(
  async ({ next, metadata }) => {
    const admin = await currentAdmin();
    if (!admin) {
      const t = await getTranslations("admin.errors");
      throw new ActionError(t("notAuthorized"));
    }
    const result = await next({ ctx: { admin } });
    if (result.success && metadata.revalidate !== false) {
      revalidatePath("/", "layout");
    }
    return result;
  },
);
```

Ajuster la clé générique (`common.actionFailed`) et le namespace `notAuthorized` selon ce que le Step 2 a trouvé dans les messages réels. Vérifier dans la doc installée (`node_modules/next-safe-action/dist/`, types) la signature exacte de `handleServerError` et du résultat de `next()` — l'API v8 peut différer légèrement de cet exemple.

- [ ] **Step 6: Run tests, vérifier le pass**

Run: `pnpm vitest run src/lib/safe-action.test.ts`
Expected: PASS.

- [ ] **Step 7: Vérif globale + commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
```bash
git add -A && git commit -m "feat(actions): next-safe-action base clients (ActionError, auth, admin)"
```

---

### Task 2: Middleware d'accès source — remplace `withWriteAccess`

**Files:**
- Create: `src/features/browser/server/source-access.ts`
- Test: `src/features/browser/server/source-access.test.ts`
- (Ne PAS supprimer `guards.ts` ici — il reste utilisé jusqu'aux tâches 7–9.)

**Interfaces:**
- Consumes: `actionClient`/`ActionError` (Task 1), `requireSourceAccess` (`src/lib/auth/access.ts`), `getFilesClient` (`src/lib/storage/client.ts`).
- Produces:
  - `sourceAccessMiddleware(opts: { need?: { edit?: boolean; delete?: boolean }; deniedKey?: string })` — middleware validé (via `createValidatedMiddleware`) contraint sur `parsedInput: { sourceId: string }`. Comportement : `requireSourceAccess(parsedInput.sourceId)` → sinon `throw new ActionError(t("browser.errors.sourceNotFound"))` ; vérifie `canEdit`/`canDelete` selon `need` → sinon `throw new ActionError(resolveKey(deniedKey))` ; injecte `ctx: { source: Source; files: Files; access: SourceCapabilities }`. `need` omis = accès lecture seule (cas `createShareLink`).
  - `deniedKey` est une clé i18n complète ; exporter aussi le resolver de clé depuis Task 1 (le rendre `export` dans `safe-action.ts` sous le nom `resolveActionMessage`) plutôt que le dupliquer.

- [ ] **Step 1: Tests d'abord** — mocks de `requireSourceAccess` et `getFilesClient` ; cas : source inaccessible → `ActionError(sourceNotFound)` ; `need.edit` sans `canEdit` → denied ; `need.delete` sans `canDelete` → denied ; accès ok → `next` appelé avec `ctx.source`/`ctx.files`. Run : `pnpm vitest run src/features/browser/server/source-access.test.ts` → FAIL.
- [ ] **Step 2: Implémenter** avec `createValidatedMiddleware<{ parsedInput: { sourceId: string } }>().define(...)` (vérifier l'import exact dans les types du package). Reprendre les messages de `guards.ts` (`browser.errors.sourceNotFound`).
- [ ] **Step 3: Run tests** → PASS, puis `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 4: Commit** — `git commit -m "feat(browser): source access middleware for next-safe-action"`

---

### Task 3: Migration `admin/groups` (exemplaire de référence)

**Files:**
- Modify: `src/features/admin/actions/groups.ts` (6 actions)
- Modify: `src/features/admin/lib/schema.ts` (schémas d'input objet si manquants)
- Modify call sites: `src/features/admin/components/create-group-dialog.tsx`, `groups-table.tsx`, `group-members-dialog.tsx`, `source-access.tsx`

**Interfaces:**
- Consumes: `adminActionClient`, `ActionError` (Task 1) ; DAL groups/permissions inchangée.
- Produces: actions exportées mêmes noms, nouvelle signature objet unique. Ex. `createGroup({ name })`, `deleteGroup({ groupId })`, `addGroupMember({ groupId, userId })`, `removeGroupMember({ groupId, userId })`, `upsertSourceGrant(grantInput)`, `removeSourceGrant({ grantId })`. Retour natif next-safe-action.

- [ ] **Step 1: Migrer les actions.** Modèle exact pour `createGroup` (appliquer le même à chacune) :

```ts
"use server";

import { getTranslations } from "next-intl/server";
import { grantInputSchema, groupNameSchema } from "@/features/admin/lib/schema";
import { ActionError, adminActionClient } from "@/lib/safe-action";
import { createGroup as dalCreateGroup /* ... */ } from "@/lib/dal/groups";
import { z } from "zod";

export const createGroup = adminActionClient
  .metadata({
    actionName: "admin.createGroup",
    failureKey: "admin.errors.createGroupFailed",
  })
  .inputSchema(z.object({ name: groupNameSchema }))
  .action(async ({ parsedInput }) => {
    const t = await getTranslations("admin.errors");
    if ((await dalCreateGroup(parsedInput.name)) === "name-taken") {
      throw new ActionError(t("groupNameTaken"));
    }
  });
```

Règles : chaque `failureMessage` actuel devient `failureKey` (retrouver la clé dans le `t(...)` d'origine) ; chaque `actionError(msg)` métier devient `throw new ActionError(msg)` ; les ids nus prennent `z.string().min(1)` (ex. `z.object({ groupId: z.string().min(1) })`). `upsertSourceGrant` garde `grantInputSchema` tel quel comme `inputSchema`.

- [ ] **Step 2: Migrer les call sites.** Modèle : `const result = await createGroup({ name }); if (result.serverError) { toast.error(result.serverError); return; }`. Pour `create-group-dialog.tsx` (style FormAlert) : `setServerError(result.serverError)` ; considérer aussi `result.validationErrors` (message plat via `result.validationErrors.formErrors`/`fieldErrors` — vérifier la forme flattened dans les types) comme repli avant le succès.
- [ ] **Step 3: Vérifier** — `pnpm typecheck && pnpm lint && pnpm test` → PASS.
- [ ] **Step 4: Commit** — `git commit -m "refactor(admin): migrate group actions to next-safe-action"`

---

### Task 4: Migration `admin/users`

**Files:** Modify `src/features/admin/actions/users.ts` (5 actions), `src/features/admin/lib/schema.ts`, call sites `create-user-dialog.tsx`, `users-table.tsx`.

Comme Task 3 (relire son Step 1 pour le modèle complet). Spécificités :
- `createUser` : `inputSchema(createUserSchema)` (existe déjà).
- `setUserRole({ userId, role })` : `z.object({ userId: z.string().min(1), role: roleSchema })` — le self-check `userId === ctx.admin.id` → `throw new ActionError(t("cannotChangeOwnRole"))` (clé actuelle du fichier).
- `banUser`/`unbanUser`/`removeUser` : `z.object({ userId: z.string().min(1) })` + self-checks conservés via `ctx.admin`.
- `failureKey` = clés des `failureMessage` actuels.

- [ ] Migrer les 5 actions ; [ ] migrer les call sites ; [ ] `pnpm typecheck && pnpm lint && pnpm test` ; [ ] commit `refactor(admin): migrate user actions to next-safe-action`.

---

### Task 5: Migration `admin/settings`

**Files:** Modify `src/features/admin/actions/settings.ts` (9 actions), call sites `settings-form.tsx`, `smtp-settings-form.tsx`.

Comme Task 3. Spécificités :
- Booleans : `setSignUpEnabled({ enabled })` avec `z.object({ enabled: z.boolean() })` ; idem `setPublicSharing`, `setOidcOnlyEnabled`.
- `setPublicSharing`, `setSharePolicy`, `sendTestEmail` : `metadata.revalidate: false` (comportement actuel).
- `setTwoFactorPolicy` / `setAuditRetention` : leurs schémas inline actuels (`twoFactorPolicySchema`, `auditRetentionSchema`) deviennent le `inputSchema` (enveloppés en objet : `z.object({ policy: ... })`, `z.object({ days: ... })`).
- `resetSmtpSettings` / `sendTestEmail` : sans input → `inputSchema(z.object({}))` et call sites `action({})` (ou omettre `.inputSchema` si l'API v8 le permet — vérifier les types).
- `setOidcOnlyEnabled` : le refus "pas de SSO" → `throw new ActionError(t(<clé actuelle>))`.

- [ ] Migrer les 9 actions ; [ ] call sites (le helper `run(work, success)` de `settings-form.tsx` passe sur `result.serverError`) ; [ ] vérif ; [ ] commit `refactor(admin): migrate settings actions to next-safe-action`.

---

### Task 6: Migration `admin/sso` + `admin/branding`

**Files:** Modify `src/features/admin/actions/sso.ts` (2), `branding.ts` (2), call sites `sso-providers-form.tsx`, `branding-form.tsx`.

Comme Task 3. `registerSsoProvider` → `inputSchema(ssoProviderSchema)` ; `removeSsoProvider({ providerId })` → `z.object({ providerId: z.string().min(1) })` ; `updateBranding` → `inputSchema(brandingSchema)` ; `resetBranding` → sans input.

- [ ] Migrer les 4 actions ; [ ] call sites ; [ ] vérif ; [ ] commit `refactor(admin): migrate sso and branding actions to next-safe-action`.

---

### Task 7: Migration `browser/entries`

**Files:** Modify `src/features/browser/actions/entries.ts` (7 actions), `src/features/browser/lib/schemas.ts` (schémas objet), call sites `use-entry-deletion.ts`, `inline-rename.tsx`, `new-folder-popover.tsx`, `file-browser.tsx`.

**Interfaces:** Consumes `sourceAccessMiddleware` (Task 2), `authActionClient` n'est PAS utilisé ici — le middleware source porte déjà la session via `requireSourceAccess`. Modèle exact pour `createFolder` :

```ts
export const createFolder = actionClient
  .metadata({ actionName: "browser.createFolder" })
  .inputSchema(
    z.object({ sourceId: z.string().min(1), prefix: z.string(), name: folderNameSchema }),
  )
  .useValidated(
    sourceAccessMiddleware({ need: { edit: true }, deniedKey: "browser.errors.<clé denied actuelle>" }),
  )
  .action(async ({ parsedInput, ctx }) => {
    // corps actuel de createFolder, avec ctx.source / ctx.files
  });
```

Spécificités :
- Retrouver pour chaque action la clé du `denied` actuel dans `entries.ts` (elles passent par `t(...)` — reprendre la même clé) et le `failureMessage` éventuel (`renameFolder`) en `failureKey`.
- `deleteObject`/`deleteFolder`/`deleteEntries` : `need: { delete: true }`.
- Les gardes manuelles (`endsWith("/")`, `DELETE_ENTRIES_MAX`, `EntryTarget[]`) migrent DANS le schéma zod : `z.object({ sourceId, targets: z.array(entryTargetSchema).min(1).max(DELETE_ENTRIES_MAX) })` avec `entryTargetSchema` ajouté à `browser/lib/schemas.ts` si absent (refléter le type `EntryTarget` existant).

- [ ] Migrer les 7 actions ; [ ] call sites ; [ ] vérif ; [ ] commit `refactor(browser): migrate entry actions to next-safe-action`.

---

### Task 8: Migration `browser/share` + `browser/drop`

**Files:** Modify `src/features/browser/actions/share.ts` (1), `drop.ts` (1), call sites `share-dialog.tsx`, `drop-link-dialog.tsx`.

Spécificités :
- `createShareLink` : middleware `sourceAccessMiddleware({})` (lecture seule). Input : fusionner en un seul objet `z.object({ sourceId, key, ...shareOptionsSchema.shape })` ou garder `options` imbriqué — choisir l'objet plat SEULEMENT si les call sites restent simples, sinon `z.object({ sourceId, key, options: shareOptionsSchema })`. Les checks policy (`isPublicSharingEnabled`, `source.allowPublicShares`, `getSharePolicy`) restent dans le body → `throw new ActionError(...)` avec les messages actuels. Retourne `{ token }` → call site : `result.data.token`.
- `createDropLink` : `sourceAccessMiddleware({ need: { edit: true }, deniedKey: <clé actuelle> })`, mêmes principes, `dropOptionsSchema` inline devient le sous-schéma d'input.
- Session pour l'owner id : disponible via `getSession()` dans le body (inchangé).

- [ ] Migrer les 2 actions ; [ ] call sites ; [ ] vérif ; [ ] commit `refactor(browser): migrate share and drop link actions to next-safe-action`.

---

### Task 9: Migration `browser/transfer`

**Files:** Modify `src/features/browser/actions/transfer.ts` (3), call sites `copy-to-dialog.tsx`, `move-to-dialog.tsx`, `move-dialog.tsx`.

Spécificités :
- `moveEntries` : pattern Task 7 (`sourceAccessMiddleware({ need: { edit: true } })`, `failureKey` = clé actuelle).
- `copyEntriesToSource` / `moveEntriesToSource` : **deux** sources — le middleware ne couvre que `sourceId` (origine, en lecture pour copy / + `canEdit` origine pour move via `ctx.access.canEdit` vérifié dans le body). La destination reste vérifiée dans le body (`requireSourceAccess(destSourceId)` + `canEdit`) avec `throw new ActionError` et les messages actuels. Input : `z.object({ sourceId, destSourceId: z.string().min(1), targets: z.array(entryTargetSchema).min(1).max(COPY_ENTRIES_MAX), destPrefix: z.string() })` ; `moveEntriesToSource` rejette `destSourceId === sourceId` via `.refine(...)` sur le schéma.
- Data de retour (`CrossCopySummary`/`CrossMoveSummary`) : inchangée, call sites lisent `result.data.copied` etc.

- [ ] Migrer les 3 actions ; [ ] call sites ; [ ] vérif ; [ ] commit `refactor(browser): migrate transfer actions to next-safe-action`.

---

### Task 10: Migration `sources/actions.ts`

**Files:** Modify `src/features/sources/actions.ts` (5 actions), call sites `source-form.tsx`, `use-source-actions.tsx`, `migrate-source-dialog.tsx`.

Spécificités :
- Toutes sur `adminActionClient` (le guard actuel est `currentAdmin()` inline). Vérifier si ces actions provoquaient `revalidatePath` aujourd'hui : **non** (pas de `withAdmin`) → mettre `revalidate: false` sur les 5 pour ne pas changer le comportement.
- `testSourceConnection({ input, sourceId? })` : garder `SourceFormValues` brut en entrée n'est pas acceptable — le schéma d'action est `z.object({ input: sourceInputSchema, sourceId: z.string().optional() })` pour create, mais le mode edit re-parse via `resolveUpdateInput` (secret réinjecté). Solution : `inputSchema(z.object({ input: z.unknown(), sourceId: z.string().optional() }))` est INTERDIT (validation garantie) — à la place, deux chemins dans le body après un schéma union : `z.object({ sourceId: z.string().optional(), input: sourceFormSchema })` où `sourceFormSchema` = le schéma le plus permissif des deux (`sourceUpdateSchema`), puis `resolveUpdateInput`/`sourceInputSchema.parse` affinent dans le body comme aujourd'hui. Préserver exactement la logique actuelle de `resolveUpdateInput` et `guardLocalSource`.
- `createSource({ input })`, `updateSource({ sourceId, input })`, `removeSource({ id })`, `copySourceContents` : le `migrationInputSchema` inline (`z.object({ sourceId: z.uuid(), destId: z.uuid() })`) devient le `inputSchema`.
- `migrate-source-dialog.tsx` lit `result.data.{transferred,skipped,failed}`.

- [ ] Migrer les 5 actions ; [ ] call sites ; [ ] vérif ; [ ] commit `refactor(sources): migrate source actions to next-safe-action`.

---

### Task 11: Migration `shares`, `drops`, `auth` (publiques + owner-scoped)

**Files:** Modify `src/features/shares/actions.ts` (2), `src/features/drops/actions.ts` (2), `src/features/auth/actions.ts` (1) ; call sites `share-password-form.tsx`, `shares-table.tsx`, `drop-password-form.tsx`, `drop-links-table.tsx`, `user-menu.tsx`.

Spécificités :
- `unlockShare({ token, password })` / `unlockDropLink({ token, password })` : **`actionClient` de base, sans middleware auth** (publiques par design). Schéma `z.object({ token: z.string().min(1), password: z.string().min(1) })`. Préserver le délai 500ms sur mauvais mot de passe.
- `revokeShareLink({ id })` / `revokeDropLinkAction({ id })` : `authActionClient` ; le check owner-ou-admin reste dans le body (`ctx.user`), `throw new ActionError` avec les messages actuels.
- `setLocale` : `actionClient` de base (préférence cookie, pas d'auth requise — comportement actuel), `inputSchema(localeSchema)` (déjà objet `{ locale }`). Call site `user-menu.tsx` ignore le résultat — inchangé.

- [ ] Migrer les 5 actions ; [ ] call sites ; [ ] vérif ; [ ] commit `refactor(shares,drops,auth): migrate remaining actions to next-safe-action`.

---

### Task 12: Nettoyage final + docs + build

**Files:**
- Delete: `src/lib/action-result.ts`, `src/lib/action-result.test.ts`, `src/features/admin/server/guard.ts`, `src/features/browser/server/guards.ts`
- Modify: `ARCHITECTURE.md`, `AGENTS.md` (la convention « server actions returning ActionResult » devient « next-safe-action : `adminActionClient`/`authActionClient`/`sourceAccessMiddleware`, inputs validés par `.inputSchema()`, erreurs via `ActionError` »)

- [ ] **Step 1:** `Grep "ActionResult|actionOk|actionError|withAdmin|withWriteAccess"` sur `src/` → zéro occurrence hors fichiers à supprimer. Supprimer les 4 fichiers.
- [ ] **Step 2:** Mettre à jour `ARCHITECTURE.md` et `AGENTS.md` (sections mutations/guards).
- [ ] **Step 3:** Vérif complète — Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → tout PASS.
- [ ] **Step 4:** Commit — `git commit -m "refactor: drop legacy ActionResult pattern, document next-safe-action conventions"`
- [ ] **Step 5:** S'arrêter là : Lionel teste l'UI manuellement avant tout merge.
