# Refactoring architecture — s3-bucket-ui

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructurer le projet en une architecture Next.js 16 feature-based cohérente et maintenable (open source), sans changer le comportement de l'application.

**Architecture:** Passage à `src/`, features découpées en sous-dossiers (`lib/`, `server/`, `api/`, `components/`), DAL `server-only` conservée et consolidée dans `src/lib/dal/`, conventions unifiées pour les server actions (`ActionResult` + Zod), TanStack Query (`queryOptions` factories par feature), formulaires (kit TanStack Form partout), et routes API regroupées sous `app/api/` avec un format d'erreur JSON unique.

**Tech Stack:** Next.js 16.2.10 (App Router, Turbopack), React 19.2.7, Prisma 7.8 (generator `prisma-client`, adapter pg), TanStack Query 5 / Form 1 / Table 8, nuqs 2, Zod 4, Tailwind 4, shadcn/radix, Biome 2.5, Vitest 4, pnpm.

## Global Constraints

- **Aucun changement fonctionnel** : mêmes écrans, mêmes comportements, mêmes URLs de pages (`/`, `/activity`, `/source/[id]`). Seules les URLs des route handlers internes changent (fetchers mis à jour en même temps).
- **Reads jamais en server action** : RSC/SSR d'abord, sinon route GET + TanStack Query (décision projet existante, commit `6457d66`).
- **Tous les formulaires en TanStack Form** (`useAppForm` du kit `forms/`) + server actions typées.
- **Pas de tests E2E automatiques** : vérification = `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. L'utilisateur teste manuellement.
- **Pas de barrel files** (`index.ts` d'export public par feature) — imports directs de fichiers.
- **Pas d'imports cross-feature** ; le partagé va dans `src/lib`, `src/components`, `src/forms`, `src/hooks`.
- **`prisma.` uniquement dans `src/lib/dal/`** (+ health route via DAL) ; `process.env` uniquement via `src/lib/env.ts`.
- Commits fréquents, un commit par tâche minimum, préfixes `refactor:`/`chore:`/`docs:`.

---

## Sources (décisions documentées)

| Décision | Source | Statut |
| --- | --- | --- |
| DAL `server-only` + DTO minimal, actions minces qui délèguent, validation Zod à la frontière, retour d'action minimal | Next.js « Data Security » (doc embarquée `node_modules/next/dist/docs/01-app/02-guides/data-security.md`, = nextjs.org/docs/app/guides/data-security) | Officiel |
| `src/` folder pour séparer code applicatif et config | nextjs.org/docs/app/api-reference/file-conventions/src-folder + « Project Structure » (doc embarquée) | Officiel |
| Singleton PrismaClient `globalThis` + driver adapter pg | prisma.io/docs/orm/more/help-and-troubleshooting/nextjs-help + prisma.io/docs/guides/nextjs | Officiel |
| Generator `prisma-client` avec `output` hors node_modules, dossier généré exclu du lint et non commité (régénéré au postinstall) | prisma.io/blog/why-prisma-orm-generates-code-into-node-modules-and-why-it-ll-change | Officiel |
| Types Prisma générés en interne (`Prisma.XGetPayload` + `satisfies`), DTOs maison à la frontière client | prisma.io/docs/orm/prisma-client/type-safety/operating-against-partial-structures-of-model-types + Next.js Data Security | Officiel |
| Schema single-file tant que petit (multi-file GA seulement si ça grossit) | prisma.io/blog/organize-your-prisma-schema-with-multi-file-support | Officiel |
| `queryOptions()` = pattern canonique v5, une factory par feature | tanstack.com/query/v5/docs/framework/react/guides/query-options + tkdodo.eu/blog/the-query-options-api, tkdodo.eu/blog/effective-react-query-keys | Officiel + communautaire-canonique |
| Structure feature `features/<f>/{api,components,hooks,lib,server}`, flux `shared → features → app`, pas de barrels | github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md | Communautaire (~30k ★) |
| Composants par feature + serveur par domaine (référence de projets réels) | github.com/Dokploy/dokploy (`apps/dokploy/`), github.com/calcom/cal.com, github.com/documenso/documenso | Communautaire (vérifié) |
| Pattern maison `ActionResult` suffisant (pas de next-safe-action pour ~11 actions) | next-safe-action.dev (évalué puis écarté : dépendance + indirection non justifiées à cette échelle, KISS) | Décision projet |

**Choix challengés :**
- **On garde la DAL centralisée dans `lib/dal/`** (plutôt que de l'éclater par feature) : c'est la reco officielle Next.js, elle est déjà propre, et `browser` + `sources` consomment tous deux `getSource` — l'éclater créerait des imports cross-feature.
- **On ne rajoute PAS de couche repository/service générique au-dessus de Prisma** : PrismaClient est déjà un repository typé ; des fonctions nommées par modèle suffisent (consensus officiel + communautaire).
- **Auth des reads volontairement hors scope** : le modèle de sécurité (reverse proxy authentifiant) est une décision produit existante, documentée dans ARCHITECTURE.md, pas un sujet de refactoring.
- **`app/api/` pour tous les route handlers** : les 7 routes métier sous `app/source/[id]/` mélangent pages et API ; on regroupe sous `app/api/sources/[id]/` (URLs internes uniquement, consommées par nos fetchers et attributs `src`).

---

## Architecture cible

```
prisma/
├── schema.prisma                     # single-file, generator → ../src/generated/prisma
src/
├── app/                              # routing UNIQUEMENT (pages minces + route handlers)
│   ├── layout.tsx, page.tsx, error.tsx, not-found.tsx, globals.css, favicon.ico
│   ├── activity/page.tsx
│   ├── source/[id]/page.tsx, loading.tsx
│   └── api/
│       ├── health/route.ts
│       └── sources/[id]/{config,details,download,preview,share,text,thumbnail,upload}/route.ts
├── components/
│   ├── ui/                           # shadcn (lint off)
│   ├── layout/                       # app-sidebar, command-palette, theme-toggle
│   ├── providers/                    # query-provider, theme-provider
│   └── confirm-dialog.tsx            # partagé (nouveau)
├── features/
│   ├── browser/
│   │   ├── actions.ts                # 'use server' — 7 write actions, minces
│   │   ├── api/
│   │   │   ├── client.ts             # fetchers HTTP typés (ex api.ts)
│   │   │   └── queries.ts            # queryOptions factories (nouveau)
│   │   ├── components/               # file-browser + extraits (dialogs/)
│   │   ├── hooks/
│   │   │   ├── use-uploads.ts
│   │   │   └── use-browser-selection.ts (extrait)
│   │   ├── lib/                      # pur : entries, listing, move, drop, file-types,
│   │   │   └── *.ts + *.test.ts      #       limits, sort-param, view, operation-labels
│   │   └── server/                   # server-only : service.ts, guards.ts, mutations.ts
│   └── sources/
│       ├── actions.ts
│       ├── api/{client.ts, queries.ts}
│       ├── components/               # source-form, source-menu, add-source-dialog, provider-icon.tsx
│       ├── lib/                      # providers.ts (pur, sans icônes), region.ts, schema.ts
│       └── server/                   # storage.ts
├── forms/                            # kit TanStack Form partagé (inchangé)
├── hooks/use-mobile.ts
├── generated/prisma/                 # généré, gitignoré, exclu Biome
└── lib/
    ├── dal/{sources.ts, operations.ts}
    ├── action-result.ts              # type partagé (nouveau)
    ├── api-error.ts                  # réponses d'erreur JSON unifiées (nouveau)
    ├── prisma.ts, env.ts, crypto.ts, format.ts, utils.ts, paths.ts (nouveau)
instrumentation.ts → src/instrumentation.ts
```

---

### Task 1: Branche + nettoyage des résidus

**Files:**
- Delete: `data/app.db`, `data/app.db-shm`, `data/app.db-wal`
- Delete: `lib/generated/prisma/**` (regénéré ensuite)
- Modify: `.gitignore`

- [ ] **Step 1:** `git checkout -b refactor/architecture`
- [ ] **Step 2:** Supprimer `data/` (SQLite résiduel d'avant PostgreSQL) et vérifier qu'aucun code ne le référence (`grep -r "app.db"` → 0 hit attendu hors lockfiles).
- [ ] **Step 3:** Ajouter au `.gitignore` : `/src/generated/` (et retirer du suivi `lib/generated/prisma` s'il est commité : `git rm -r --cached lib/generated/prisma` — le client contient 5 modèles morts d'une auth abandonnée : Account, Session, User, Verification, SourceAccess).
- [ ] **Step 4:** `pnpm prisma generate` puis `pnpm typecheck` → PASS. Commit `chore: remove stale sqlite db and stale generated prisma client`.

### Task 2: Migration vers `src/`

**Files:**
- Move: `app/`, `components/`, `features/`, `forms/`, `hooks/`, `lib/`, `instrumentation.ts` → `src/`
- Modify: `tsconfig.json` (`"@/*": ["./src/*"]`), `biome.json` (override `src/components/ui/**`), `components.json` (css `src/app/globals.css`), `vitest.config.ts` (alias), `prisma/schema.prisma` (`output = "../src/generated/prisma"`), `Dockerfile` (chemins COPY si nécessaires)

**Interfaces:**
- Produces: tous les imports `@/...` restent identiques (l'alias absorbe le déplacement), sauf `@/lib/generated/prisma/*` → `@/generated/prisma/*`.

- [ ] **Step 1:** `git mv app components features forms hooks lib instrumentation.ts src/` (créer `src/` d'abord ; déplacer `lib/generated` vers `src/generated` : `git mv src/lib/generated src/generated` après le move global).
- [ ] **Step 2:** Mettre à jour les configs listées ci-dessus ; rewrite des imports `@/lib/generated/prisma` → `@/generated/prisma` (grep-replace global).
- [ ] **Step 3:** `pnpm prisma generate && pnpm typecheck && pnpm test && pnpm build` → PASS (vérifier que Tailwind détecte bien les sources et que `next build` trouve `src/app`).
- [ ] **Step 4:** Commit `refactor: move application code under src/`.

### Task 3: Conventions partagées — ActionResult + erreurs API + helpers

**Files:**
- Create: `src/lib/action-result.ts`, `src/lib/api-error.ts`, `src/lib/paths.ts`

```ts
// src/lib/action-result.ts
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export const actionOk = <T,>(data?: T): ActionResult<T> => ({ ok: true, data });
export const actionError = <T,>(error: string): ActionResult<T> => ({ ok: false, error });
```

```ts
// src/lib/api-error.ts — format d'erreur JSON unique pour tous les route handlers
import { NextResponse } from "next/server";

export function apiError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}
```

```ts
// src/lib/paths.ts — dédoublonne la logique parentPrefix (page.tsx + file-browser)
export function parentPrefix(prefix: string): string | null {
  const segments = prefix.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  return segments.length === 1 ? "" : `${segments.slice(0, -1).join("/")}/`;
}
```

- [ ] **Step 1:** Créer les trois fichiers (adapter `parentPrefix` à la sémantique exacte actuelle des deux implémentations existantes — les lire d'abord ; si elles divergent, reproduire chacune et n'unifier que si identiques).
- [ ] **Step 2:** Test unitaire `src/lib/paths.test.ts` (racine → null, un segment → "", nested → parent avec `/`). `pnpm test` → PASS.
- [ ] **Step 3:** Commit `refactor: add shared ActionResult, apiError and path helpers`.

### Task 4: Restructurer `features/sources/` en sous-dossiers

**Files:**
- Move: `schema.ts`, `region.ts` (+ tests) → `sources/lib/` ; `storage.ts` → `sources/server/` ; `api.ts` → `sources/api/client.ts`
- Split: `providers.ts` → `sources/lib/providers.ts` (données pures, `icon` remplacé par un id string) + `sources/components/provider-icon.tsx` (mapping id → LucideIcon)
- Modify: tous les importeurs (`app-sidebar`, `source-form`, home page, `storage.ts`, routes)

**Interfaces:**
- Produces: `PROVIDERS` sans champ `icon` React ; `ProviderIcon({ provider })` composant client ; chemins `@/features/sources/lib/*`, `@/features/sources/server/storage`, `@/features/sources/api/client`.

- [ ] **Step 1:** `git mv` selon la carte ci-dessus, corriger les imports.
- [ ] **Step 2:** Extraire les icônes de `providers.ts` : le registre devient pur (importable en `server-only` sans toucher à lucide) ; créer `provider-icon.tsx`.
- [ ] **Step 3:** `pnpm typecheck && pnpm test && pnpm lint` → PASS. Commit `refactor(sources): split feature into lib/server/api/components`.

### Task 5: Restructurer `features/browser/` en sous-dossiers

**Files:**
- Move → `browser/lib/` : `listing.ts`, `entries.ts`, `move.ts`, `drop.ts`, `file-types.ts`, `limits.ts`, `sort-param.ts`, `view.ts`, `operation-labels.ts` + leurs `.test.ts` (+ `integration.test.ts`)
- Move → `browser/server/` : `service.ts` (+ test), `guards.ts`
- Move → `browser/api/client.ts` : `api.ts`
- Move → `browser/hooks/` : `use-uploads.ts`
- Rename: `write-actions.ts` → `actions.ts` ; en extraire les helpers I/O (`movePrefix`, `deletePrefix`, …) vers `browser/server/mutations.ts` (`server-only`), les actions restent minces
- Modify: tous les importeurs

**Interfaces:**
- Produces: `@/features/browser/lib/*`, `@/features/browser/server/{service,guards,mutations}`, `@/features/browser/api/client`, `@/features/browser/actions`.

- [ ] **Step 1:** `git mv` selon la carte, corriger les imports (nombreux : file-browser, page.tsx, routes, dialogs).
- [ ] **Step 2:** Extraire `mutations.ts` de `actions.ts` (fonctions non exportées comme actions : elles perdent `"use server"` et gagnent `import "server-only"`).
- [ ] **Step 3:** `pnpm typecheck && pnpm test && pnpm lint` → PASS. Commit `refactor(browser): split feature into lib/server/api/hooks/components`.

### Task 6: Unifier les server actions (ActionResult + Zod partout)

**Files:**
- Modify: `src/features/sources/actions.ts`, `src/features/browser/actions.ts`, `src/features/browser/server/guards.ts` + tous les appelants (source-form, source-menu, dialogs, file-browser)
- Create: `src/features/browser/lib/schemas.ts` (validation Zod des inputs browser : noms d'entrée, clés, prefixes)

**Interfaces:**
- Produces: toutes les actions retournent `ActionResult` (dont `removeSource`, qui retournait `void`) ; inputs browser validés par `entryNameSchema`/`keySchema` Zod au lieu de checks manuels dispersés.

- [ ] **Step 1:** Écrire `schemas.ts` en transposant exactement les règles actuelles (`invalidEntryName`, `endsWith("/")`, trim) en Zod — tests unitaires reproduisant les cas des validations manuelles.
- [ ] **Step 2:** Convertir les actions des deux features à `ActionResult` ; `withWriteAccess` retourne `ActionResult` ; adapter les appelants (`if (!result.ok) toast.error(result.error)`).
- [ ] **Step 3:** Uniformiser l'invalidation : les actions sources gardent `revalidatePath`; les actions browser ajoutent `revalidatePath("/source/[id]", "page")` n'est PAS possible avec un param dynamique → garder `router.refresh()` côté client mais le documenter dans ARCHITECTURE.md comme convention browser (le listing est rendu par RSC).
- [ ] **Step 4:** `pnpm typecheck && pnpm test` → PASS. Commit `refactor: unify server actions on ActionResult + zod input validation`.

### Task 7: Routes API — regrouper sous `app/api/` + format d'erreur unique

**Files:**
- Move: `src/app/source/[id]/{config,details,download,preview,share,text,thumbnail,upload}/route.ts` → `src/app/api/sources/[id]/…/route.ts`
- Modify: routes (utiliser `apiError()`, importer TTL depuis `limits.ts` — supprimer le `THUMBNAIL_TTL_SECONDS = 600` hardcodé), fetchers `api/client.ts` des deux features, attributs `src`/`href` (preview, thumbnail, download) dans les composants
- Modify: `src/features/browser/lib/limits.ts` (ajouter `THUMBNAIL_TTL_SECONDS` ou réutiliser `PREVIEW_TTL_SECONDS`)

- [ ] **Step 1:** `git mv` des 7 dossiers de routes ; mettre à jour les types `RouteContext<"/api/sources/[id]/…">`.
- [ ] **Step 2:** Remplacer toutes les réponses d'erreur texte brut par `apiError(status, message)` ; TTL depuis `limits.ts`.
- [ ] **Step 3:** Grep exhaustif des anciennes URLs (`/source/${` et `"/source/`) pour mettre à jour fetchers et `src=` — attention à ne pas toucher les liens de navigation de pages (`/source/[id]` reste une page).
- [ ] **Step 4:** `pnpm typecheck && pnpm test && pnpm build` → PASS. Commit `refactor: consolidate route handlers under app/api with unified error shape`.

### Task 8: TanStack Query — `queryOptions` factories par feature

**Files:**
- Create: `src/features/browser/api/queries.ts`, `src/features/sources/api/queries.ts`
- Modify: `details-dialog.tsx`, `preview-dialog.tsx`, `file-browser.tsx`, `source-menu.tsx` (remplacer les keys inline)

```ts
// src/features/browser/api/queries.ts
import { queryOptions } from "@tanstack/react-query";
import { fetchFileDetails, fetchShareUrl, fetchTextPreview } from "./client";

export const browserQueries = {
  all: (sourceId: string) => ["browser", sourceId] as const,
  fileDetails: (sourceId: string, key: string) =>
    queryOptions({
      queryKey: [...browserQueries.all(sourceId), "details", key],
      queryFn: () => fetchFileDetails(sourceId, key),
    }),
  textPreview: (sourceId: string, key: string) =>
    queryOptions({
      queryKey: [...browserQueries.all(sourceId), "text", key],
      queryFn: () => fetchTextPreview(sourceId, key),
    }),
  shareUrl: (sourceId: string, key: string) =>
    queryOptions({
      queryKey: [...browserQueries.all(sourceId), "share", key],
      queryFn: () => fetchShareUrl(sourceId, key),
      staleTime: 0,
      gcTime: 0, // URL présignée : ne jamais servir depuis le cache
    }),
};
```

(idem `sourcesQueries.config(sourceId)` pour sources — reprendre les signatures exactes des fetchers existants dans `api/client.ts`.)

- [ ] **Step 1:** Créer les deux factories ; remplacer chaque `useQuery({queryKey: [...], queryFn})` et `queryClient.fetchQuery` inline par la factory.
- [ ] **Step 2:** `pnpm typecheck && pnpm lint` → PASS. Commit `refactor: introduce queryOptions factories per feature`.

### Task 9: Découper `file-browser.tsx` (751 lignes)

**Files:**
- Create: `src/features/browser/components/dialogs/delete-dialog.tsx` (absorbe les 2 AlertDialogs delete via ConfirmDialog), `src/features/browser/hooks/use-browser-dialogs.ts` (état des 6 dialogs), `src/features/browser/hooks/use-browser-selection.ts` (sélection + helpers targets)
- Create: `src/components/confirm-dialog.tsx` (AlertDialog destructif réutilisable — aussi utilisé par `source-menu`)
- Modify: `file-browser.tsx` (orchestration seulement, cible < 350 lignes), `source-menu.tsx`

```tsx
// src/components/confirm-dialog.tsx
"use client";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel, pending, onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 1:** Créer `ConfirmDialog`, remplacer les 3 AlertDialogs dupliqués (file-browser ×2, source-menu ×1). Adapter libellés/description exactement (lire les originaux).
- [ ] **Step 2:** Extraire `use-browser-selection.ts` (état sélection, `toTargets`, `canRename`/`canMove` calculés une fois) et `use-browser-dialogs.ts` ; remplacer le calcul `parentPrefix` inline par `@/lib/paths`.
- [ ] **Step 3:** `file-browser.tsx` ne garde que l'orchestration (layout, wiring des hooks, DnD). Vérifier ligne à ligne qu'aucun comportement ne change (mêmes handlers, mêmes gardes).
- [ ] **Step 4:** `pnpm typecheck && pnpm test && pnpm lint && pnpm build` → PASS. Commit `refactor(browser): split file-browser into hooks + shared ConfirmDialog`.

### Task 10: Unifier les formulaires sur le kit TanStack Form

**Files:**
- Modify: `src/features/browser/components/rename-dialog.tsx`, `new-folder-dialog.tsx` (passer de `<form>` manuel + useState au kit `useAppForm` de `src/forms/`, comme `source-form.tsx`)

- [ ] **Step 1:** Convertir `new-folder-dialog` : `useAppForm` + `TextField` + `SubmitButton`, validation Zod (schema de Task 6), soumission → action → `ActionResult`.
- [ ] **Step 2:** Convertir `rename-dialog` idem (valeur initiale = nom courant).
- [ ] **Step 3:** `pnpm typecheck && pnpm lint` → PASS. Commit `refactor(browser): migrate rename/new-folder dialogs to TanStack Form kit`.

### Task 11: Rangement `components/` + Biome organizeImports

**Files:**
- Move: `app-sidebar.tsx`, `command-palette.tsx`, `theme-toggle.tsx` → `src/components/layout/` ; `query-provider.tsx`, `theme-provider.tsx` → `src/components/providers/`
- Modify: `biome.json` — activer l'assist `organizeImports` (`assist.actions.source.organizeImports: "on"`), garder lint off sur `src/components/ui/**` et ajouter `src/generated/**` aux exclusions

- [ ] **Step 1:** `git mv` + imports ; activer organizeImports ; `pnpm lint:fix` (gros diff mécanique attendu — commit séparé).
- [ ] **Step 2:** `pnpm typecheck && pnpm lint && pnpm test` → PASS. Commits `refactor: organize shared components into layout/ and providers/` puis `style: enable biome import organization`.

### Task 12: Documentation

**Files:**
- Create: `docs/ARCHITECTURE.md` (structure cible, flux `shared → features → app`, conventions actions/queries/formulaires/routes, modèle de sécurité proxy, pourquoi pas de repository pattern, sources)
- Modify: `AGENTS.md` (ajouter les conventions du projet sous la note Next.js), `README.md` si l'arborescence y est décrite

- [ ] **Step 1:** Rédiger ARCHITECTURE.md (concis, avec les règles et le « pourquoi », liens sources de ce plan).
- [ ] **Step 2:** Commit `docs: add architecture guide and project conventions`.

### Task 13: Vérification finale

- [ ] **Step 1:** `pnpm prisma generate && pnpm typecheck` → PASS
- [ ] **Step 2:** `pnpm lint` → PASS ; `pnpm test` → PASS (tous les tests existants conservés)
- [ ] **Step 3:** `pnpm build` → PASS (standalone)
- [ ] **Step 4:** Relecture du diff complet (`git diff master --stat`) : vérifier qu'aucun fichier n'a été perdu, que `git log` raconte une histoire propre. Ne PAS merger — laisser la branche `refactor/architecture` pour revue humaine.

## Self-Review

- Couverture : structure src/ (T2), features en sous-dossiers (T4, T5), conventions actions (T6), routes (T7), Query (T8), god component (T9), formulaires (T10), composants partagés + imports (T11), docs (T12), résidus (T1) — tous les points du diagnostic sont adressés sauf l'auth des reads (hors scope, documenté) et `sidebar.tsx` 702 lignes (code shadcn généré, lint off, on n'y touche pas).
- Types cohérents : `ActionResult` défini T3, consommé T6/T9/T10 ; `browserQueries` défini T8 avec les fetchers renommés T5 (`api/client.ts`).
- Pas de placeholder : chaque tâche liste fichiers exacts + commandes ; le code nouveau est fourni ; les déplacements référencent les fichiers existants.
