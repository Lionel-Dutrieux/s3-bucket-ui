# Revue de code & migration PostgreSQL

> Document de travail rédigé pour la revue du matin. Branche
> `worktree-review+postgres-and-quality`. Rédigé en français ; le reste du dépôt
> reste en anglais. À supprimer avant l'ouverture d'une PR publique (ou à
> convertir en note de PR).

## TL;DR

- **Fait et vérifié** : migration complète **SQLite → PostgreSQL** (Prisma 7 +
  driver adapter `@prisma/adapter-pg`), avec de **vraies migrations** Prisma qui
  remplacent le DDL maintenu à la main. `DATABASE_URL` passe par l'environnement.
  `tsc`, `lint`, `test`, `build` **tous verts** ; migration appliquée pour de vrai
  contre un PostgreSQL 17 en conteneur (structure de table + suivi
  `_prisma_migrations` vérifiés).
- **Bug trouvé au passage** (voir §2) : au HEAD commité, le DDL de bootstrap de
  `lib/prisma.ts` était **désynchronisé** du schéma — c'est exactement la classe
  de bug que cette migration supprime. Ton intuition sur la DB était juste.
- **Ajout** : `.gitattributes` (normalisation LF) — nécessaire pour que
  `docker-entrypoint.sh` ne casse pas en CRLF, et pour un lint stable sous Windows.
- **Volontairement PAS fait** : les refactors profonds de `features/browser/*`,
  `app/activity/*` et `lib/dal/operations.ts`. Un autre agent édite ces fichiers
  en ce moment (feature audit-log non commitée). Y toucher créerait un enfer de
  merge. Ils sont documentés en §5 avec des exemples prêts à appliquer **après**
  le merge.

---

## 1. Ce que j'ai changé (migration PostgreSQL)

### Pourquoi PostgreSQL plutôt que SQLite

SQLite via `better-sqlite3` obligeait à **recréer le schéma à la main** au boot
(`BOOTSTRAP_DDL` + `COLUMN_MIGRATIONS` dans `lib/prisma.ts`), parce que la prod
tourne `node server.js` sans étape de déploiement. Deux sources de vérité — le
schéma Prisma **et** le DDL manuel — qu'il faut garder synchronisées à chaque
évolution. C'est fragile (voir §2), ça ne passe pas à l'échelle (pas de vraies
migrations, pas de rollback, pas de concurrence multi-réplica), et c'est le point
que tu sentais faible. PostgreSQL + `prisma migrate deploy` supprime la source de
vérité dupliquée : **le schéma évolue par des migrations SQL versionnées**,
appliquées automatiquement.

### Changements, fichier par fichier

| Fichier | Changement |
|---|---|
| `prisma/schema.prisma` | `provider = "postgresql"` ; `url` retiré du schéma (**Prisma 7 l'interdit**, cf. §3) ; `id` en `@db.Uuid` ; `createdAt` passe de `String` + `dbgenerated("datetime('now')")` à `DateTime @default(now()) @db.Timestamptz(3)` (typé, plus de bidouille SQLite). |
| `prisma.config.ts` | Charge `.env` via `process.loadEnvFile` (Node 22, pas de dép `dotenv`) ; déclare `migrations.path` ; fournit l'URL à la CLI via `process.env.DATABASE_URL` (**pas** `env()`, cf. §3). |
| `lib/prisma.ts` | Réécrit : `PrismaPg({ connectionString })` + `PrismaClient`. **Tout** le bloc `better-sqlite3` / `mkdirSync` / `BOOTSTRAP_DDL` supprimé. Fail-fast si `DATABASE_URL` absent. |
| `prisma/migrations/` | Migration initiale `20260713000000_init` générée offline (`prisma migrate diff --from-empty --to-schema`) + `migration_lock.toml`. **Versionnée dans git.** |
| `instrumentation.ts` | Valide aussi `DATABASE_URL` au boot (en plus de `ENCRYPTION_KEY`). |
| `package.json` | +`@prisma/adapter-pg`, +`pg`, +`@types/pg` ; −`@prisma/adapter-better-sqlite3`, −`better-sqlite3`, −`@types/better-sqlite3` ; `prisma` passe en **dependency** (nécessaire au runtime pour `migrate deploy`). Scripts : `db:push` → `db:migrate` / `db:deploy` / `db:studio`. |
| `pnpm-workspace.yaml` | Retire `better-sqlite3` de `onlyBuiltDependencies`. |
| `Dockerfile` | Runner embarque désormais la CLI Prisma + les engines (via `pnpm prune --prod`, `prisma` étant une dependency), le schéma et les migrations. `ENTRYPOINT` = `docker-entrypoint.sh`. |
| `docker-entrypoint.sh` | `prisma migrate deploy` (idempotent) **puis** `node server.js`. |
| `docker-compose.yml` | Ajoute un service `postgres:17-alpine` (healthcheck `pg_isready`, volume `bucket-ui-db`), `DATABASE_URL` câblé, `depends_on: service_healthy`. |
| `.env.example`, `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `.claude/skills/verify/SKILL.md` | Docs alignées (setup Postgres, `db:migrate`, plus de `data/app.db`). |
| `.gitattributes` | **Nouveau.** Normalisation LF (cf. §4). |

### Comment la prod applique le schéma maintenant

`docker-entrypoint.sh` lance `prisma migrate deploy` avant le serveur.
`migrate deploy` est **idempotent** (il ne joue que les migrations absentes de la
table `_prisma_migrations`), donc c'est sûr à chaque boot et compatible
multi-réplica. Plus aucun DDL à maintenir à la main : ajouter une colonne = éditer
le schéma + `pnpm db:migrate` + commit du dossier de migration généré.

### Vérifications effectuées

- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ (42 passed, 4 skipped =
  tests d'intégration S3 qui exigent un endpoint) · `pnpm build` ✅ (toutes les
  routes sont dynamiques `ƒ`, aucun prerender ne touche la DB).
- `prisma migrate deploy` **appliqué pour de vrai** sur un `postgres:17-alpine` :
  table `sources` créée avec les bons types (`uuid`, `timestamptz(3)`, colonnes
  `snake_case`, defaults), et `_prisma_migrations` marque la migration appliquée.
- `prisma generate` fonctionne **sans** `DATABASE_URL` (indispensable : le build
  Docker et le job CI `checks` n'ont pas de DB — cf. §3).

### Ce que je n'ai PAS pu vérifier moi-même

- Le **build de l'image Docker** et le run du conteneur (pas de build d'image
  dans cette session). La logique est standard et je l'ai raisonnée
  soigneusement, mais **teste `docker compose up --build` une fois** avant de
  merger. Point d'attention : le runner copie l'intégralité de `node_modules`
  prod (pour embarquer la CLI Prisma) — l'image sera plus grosse qu'avant
  (~200 MB → estimé 300-400 MB). Piste d'optimisation en §5.
- Le **chemin runtime réel** d'une requête via le driver adapter `pg` (le client
  généré par le générateur `prisma-client` est en TypeScript à imports sans
  extension, non exécutable en Node brut hors bundler). C'est le pattern Prisma 7
  documenté et le typecheck valide l'usage ; `pnpm dev` l'exercera. Migration DB +
  schéma sont, eux, prouvés.

---

## 2. Le bug qui justifie la migration

Au commit `2d2dc7e` (HEAD), `prisma/schema.prisma` déclare `allowUpload` /
`allowDelete` sur `Source`, **mais** le `BOOTSTRAP_DDL` commité de `lib/prisma.ts`
crée la table `sources` **sans ces colonnes** (ni `COLUMN_MIGRATIONS`). Résultat :
sur un volume Docker vierge (première prod), la table est créée sans
`allow_upload` / `allow_delete`, et la première écriture Prisma qui les
référence casse (`no such column`). L'autre agent l'a corrigé dans son travail
non commité — mais c'est précisément la démonstration du problème : **deux
sources de vérité qui divergent silencieusement**. Avec de vraies migrations,
ce bug est structurellement impossible.

---

## 3. Pièges Prisma 7 rencontrés (à connaître)

Prisma 7 casse plusieurs habitudes — documenté ici pour éviter de reperdre du
temps :

1. **`url` interdit dans le `datasource` du schéma.** Il faut le mettre dans
   `prisma.config.ts` (clé `datasource.url`). Le schéma ne porte plus que le
   `provider`. Le runtime, lui, se connecte via le driver adapter.
2. **`prisma.config.ts` désactive le chargement automatique de `.env`.** Sans
   `process.loadEnvFile(".env")` (ou `dotenv`), la CLI ne voit pas `DATABASE_URL`.
3. **`env("DATABASE_URL")` (helper de `prisma/config`) lève une erreur si la var
   est absente**, ce qui casse `prisma generate`. Or `generate` ne se connecte
   jamais et tourne au build Docker / en CI **sans** DB. J'utilise
   `process.env.DATABASE_URL ?? ""` pour que `generate` passe toujours ; seules
   les commandes qui se connectent (`migrate`) échoueront sur une URL vide.
4. **`migrate diff --to-schema-datamodel` a été renommé `--to-schema`.**
5. Le générateur `prisma-client` (nouveau, ESM) sort du **TypeScript** dans
   `lib/generated/prisma/` (pas du JS compilé).

---

## 4. Fins de ligne (CRLF) — pourquoi `.gitattributes`

Le worktree a été extrait avec `core.autocrlf=true` : tous les fichiers
préexistants en CRLF sur le disque. Biome exige LF → 96 « erreurs » de format
qui n'ont **rien** à voir avec le code (fichiers non modifiés inclus). Plus grave
pour la prod : un `docker-entrypoint.sh` en CRLF a un shebang `#!/bin/sh\r`
invalide → le conteneur ne démarre pas. `.gitattributes` (`* text=auto eol=lf`,
`*.sh eol=lf`) fixe la cause racine et rend le lint reproductible entre Windows,
macOS et la CI Linux. (Les blobs git étaient déjà en LF ; l'ajout ne réécrit donc
pas l'historique.)

---

## 5. Revue qualité — recommandations priorisées

**Constat général : le code est déjà de très bonne qualité.** L'architecture en
couches (`app → features → forms|lib → lib/generated`), la règle « une seule
source de vérité pour la validation » (Zod), le registre déclaratif de providers,
le chiffrement confiné dans la DAL, l'état de navigation dans l'URL, les tests
ciblés sur la logique pure — c'est du niveau des bons dépôts open-source.
`ARCHITECTURE.md` est excellent. Les recommandations ci-dessous sont des
raffinements, pas des corrections d'un code cassé.

> ⚠️ **Non implémentées volontairement** : la plupart touchent
> `features/browser/*`, activement édité par l'autre agent. À appliquer **après**
> le merge de sa feature audit-log, pour éviter les conflits.

### P1 — Fort impact, faible risque

**P1.1 — Découper `features/browser/actions.ts` (465 lignes).**
Le fichier mélange des **lectures** (`getShareUrl`, `getPreviewUrl`,
`getTextPreview`, `getFileDetails`) et des **écritures** (`createFolder`,
`renameObject`, `renameFolder`, `deleteObject`, `deleteFolder`, `deleteEntries`).
Séparer en `features/browser/read-actions.ts` et `write-actions.ts` (ou
`queries.ts` / `mutations.ts`) clarifie la surface, aligne avec la distinction
lecture/écriture déjà centrale dans le produit, et raccourcit les diffs. *(Fichier
de l'autre agent → après merge.)*

**P1.2 — Factoriser le préambule répété des actions d'écriture.**
Chaque mutation refait `getSource` + « source not found » + check de permission +
`try/catch` avec un `console.error("[browser] X failed (source=…, provider=…)")`.
Un helper concentrerait la garde et le logging :

```ts
// features/browser/guards.ts
type Perm = "upload" | "delete" | "both";

export async function withSource<T>(
  sourceId: string,
  perm: Perm,
  run: (source: Source, files: Files) => Promise<T>,
  onError: string,
): Promise<T | { error: string }> {
  const source = await getSource(sourceId);
  if (!source) return { error: "Source not found." };
  if ((perm === "upload" || perm === "both") && !source.allowUpload)
    return { error: "Uploads are not allowed on this source." };
  if ((perm === "delete" || perm === "both") && !source.allowDelete)
    return { error: "Deletions are not allowed on this source." };
  try {
    return await run(source, getFilesClient(source));
  } catch (error) {
    console.error(`[browser] ${onError} (source=${source.id}, provider=${source.provider}):`, error);
    return { error: `Could not ${onError}.` };
  }
}
```

Chaque action tombe alors à ~5 lignes de logique métier. *(Fichier de l'autre
agent → après merge.)*

**P1.3 — Un module d'env typé (comme dokploy).**
`ENCRYPTION_KEY` est lu dans `crypto.ts`, `instrumentation.ts` (regex),
`crypto.test.ts` ; `DATABASE_URL` désormais dans `prisma.ts` + `instrumentation`.
dokploy centralise ça dans un `@dokploy/server`/`env` validé par Zod. Un
`lib/env.ts` (Zod, validé une fois) donnerait un accès typé unique. *Attention* :
`crypto.test.ts` réassigne `process.env.ENCRYPTION_KEY` par test — un module
validé à l'import le casserait ; le faire en `getter` paresseux. Valeur réelle
mais à faire soigneusement → je ne l'ai pas bâclé ce soir.

### P2 — Bon rapport valeur/risque

**P2.1 — Extraire les constantes « magiques » de limites.**
`RENAME_FOLDER_MAX_OBJECTS`, `DELETE_FOLDER_MAX_ROUNDS`, `DELETE_ENTRIES_MAX`,
`PAGE_SIZE`, TTLs des URLs présignées… sont dispersés en tête de plusieurs
fichiers. Les regrouper dans `features/browser/limits.ts` documenté les rend
découvrables et ajustables d'un endroit.

**P2.2 — Nommage : `getFilesClient` vs `Files` (SDK).** L'aller-retour
`source → getFilesClient(source) → files.list()` est bon. Envisager d'exposer un
petit type `BrowserClient` en façade pour ne pas fuiter le type `Files` du SDK
dans toute la feature (couplage). Faible priorité.

**P2.3 — `classifyStorageError` (service.ts) mérite un test unitaire.** C'est de
la logique pure et à risque (parcours de chaîne de causes, codes AWS/Azure). Elle
n'a pas de `*.test.ts` alors que la doctrine du repo (CONTRIBUTING) l'exige pour
la logique pure. Ajouter `service.test.ts` avec des erreurs AWS/Azure simulées.

### P3 — Cosmétique / à surveiller

- **P3.1** — `README.md` décrit encore l'app comme « read-only file browser » en
  intro alors que l'écriture opt-in existe. À harmoniser (c'est du ressort de la
  feature de l'autre agent).
- **P3.2** — `pnpm-lock.yaml` : bien vérifier après merge que `better-sqlite3` a
  totalement disparu de l'arbre (je l'ai retiré de `package.json` + workspace).
- **P3.3** — Envisager un `docker-compose.dev.yml` (juste Postgres) pour le dev
  local, référencé par le README, plutôt qu'un `docker run` à copier-coller.

---

## 6. Comparaison avec dokploy

Ce que dokploy fait et qui pourrait inspirer la suite, par ordre de pertinence :

1. **Migrations DB versionnées** → **fait** ici (dokploy utilise Drizzle +
   `migrate`, même principe : le schéma évolue par migrations, jamais à la main).
2. **Module d'env validé** (Zod) centralisé → recommandé en P1.3.
3. **Barrel exports / frontières de modules nettes** — déjà bien respecté ici via
   `features/*`. Rien à faire.
4. **Couche service séparée des actions** — le repo a déjà `service.ts` /
   `listing.ts` ; le découpage read/write (P1.1) pousse un cran plus loin.

Ce qu'il **ne faut pas** copier de dokploy : sa complexité (monorepo, tRPC,
serveur séparé, Docker-in-Docker). Le mono-app KISS d'ici est un atout — le garder.

---

## 7. Pour demain (merge)

1. `git log`/`git diff master` sur cette branche pour relire.
2. **Teste `docker compose up --build`** (le seul point non vérifié end-to-end).
3. Merge la feature audit-log de l'autre agent **d'abord**, puis rebase cette
   branche : le seul vrai conflit attendu est `prisma/schema.prisma` (ajouter le
   modèle `Operation`) et `lib/prisma.ts`. Avec les vraies migrations, réintégrer
   `Operation` = éditer le schéma + `pnpm db:migrate` (plus de DDL à la main).
4. Applique les refactors P1 une fois le merge stabilisé.
5. Supprime ce `REVIEW.md` (ou transforme-le en description de PR).
