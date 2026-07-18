# Migration des server actions vers next-safe-action

Date : 2026-07-18 — validé par Lionel.

## Objectif

Remplacer le pattern maison (`ActionResult` + `withAdmin` / `withWriteAccess` +
validation zod ad hoc) par [next-safe-action](https://next-safe-action.dev/)
(v8) sur **la totalité** des ~45 server actions, pour obtenir :

- une validation d'input **garantie** (schéma zod lié à la signature de
  l'action — plus d'arguments positionnels non validés) ;
- des **clients middleware** qui portent l'auth (session, admin, accès source)
  au lieu de wrappers à appeler manuellement ;
- moins de boilerplate (try/catch/log factorisés dans `handleServerError`) ;
- un standard communautaire documenté à la place du pattern maison.

## Décisions actées

- **Migration complète** en une branche : `ActionResult`, `withAdmin`,
  `withWriteAccess` sont supprimés à la fin.
- **Forme de retour native** next-safe-action côté client :
  `{ data, serverError, validationErrors }`. Les ~40 call sites qui font
  `if (result.ok)` passent sur `if (result.serverError)` / `result.data`.
- **Pas de `useAction`** pour l'instant : les composants continuent d'appeler
  les actions directement (introduction possible plus tard).
- Tous les inputs deviennent **un objet unique** validé par zod (fin des
  arguments positionnels).

## Architecture

### 1. Infra partagée — `src/lib/safe-action.ts`

- `ActionError` : classe d'erreur dont le message est **déjà traduit et
  montrable en UI**. Les actions et middlewares font
  `throw new ActionError(t("groupNameTaken"))`.
- Client de base via `createSafeActionClient` :
  - `handleServerError(e, { metadata })` : si `e instanceof ActionError` →
    renvoie `e.message` ; sinon `console.error` avec le tag
    `[<actionName>] failed:` + retour d'un message générique i18n
    (équivalent de `browser.errors.actionFailed`). Reproduit le logging
    uniforme des guards actuels.
  - `defineMetadataSchema` : `{ actionName: z.string(), revalidate:
    z.boolean().optional() }` — obligatoire sur chaque action, remplace les
    champs `action` / `context` des guards pour les logs.
  - `defaultValidationErrorsShape: "flattened"`.
- `authActionClient` : base + middleware session (`requireSession`, throw
  `ActionError` sinon).
- `adminActionClient` : base + middleware `currentAdmin()` (throw
  `ActionError(admin.errors.notAuthorized)` sinon, `admin` injecté dans
  `ctx`) + `revalidatePath("/", "layout")` après un `next()` réussi —
  comportement actuel de `withAdmin`, débrayable via metadata
  `revalidate: false`.

### 2. Middleware d'accès source — remplace `withWriteAccess`

Factory `sourceAccessMiddleware({ edit?, delete? })` construite avec
`createValidatedMiddleware`, contrainte sur
`parsedInput: { sourceId: string }` :

- `requireSourceAccess(sourceId)` — sinon throw
  `ActionError(browser.errors.sourceNotFound)` (les sources illisibles
  restent invisibles, comportement uniforme actuel) ;
- vérifie `access.canEdit` / `access.canDelete` selon les capabilities
  demandées — sinon throw `ActionError` avec le message « denied » propre à
  l'action, passé en argument de la factory sous forme de clé i18n
  (résolue dans le middleware via `getTranslations`) ;
- injecte `ctx: { source, files: getFilesClient(source) }`.

Convention : **toute action browser a `sourceId` dans son schéma d'input.**

### 3. Les actions (~45, 13 fichiers)

Chaque action devient :

```ts
export const createGroup = adminActionClient
  .metadata({ actionName: "admin.createGroup" })
  .inputSchema(z.object({ name: groupNameSchema }))
  .action(async ({ parsedInput, ctx }) => { ... });
```

- Les erreurs métier (`name-taken`, etc.) → `throw new ActionError(t(...))`
  ou `returnValidationErrors` quand l'erreur cible un champ précis.
- Fichiers concernés : `features/{admin,browser,sources,drops,shares,auth}`
  (`actions.ts` / `actions/*.ts`).
- Suppression finale : `src/lib/action-result.ts`,
  `features/admin/server/guard.ts`, `features/browser/server/guards.ts`.

### 4. Les call sites (~40 composants)

Mise à jour mécanique : appel avec un objet unique, narrowing sur
`result.serverError` (toast) / `result.data` (succès). Les
`validationErrors` sont affichées quand le formulaire s'y prête (kit
TanStack Form inchangé par ailleurs).

### 5. Vérification

`pnpm typecheck && pnpm lint && pnpm test && pnpm build` ; test UI manuel
par Lionel (pas d'E2E automatique).

## Contraintes projet

- i18n : tout message montré à l'utilisateur passe par next-intl, résolu
  côté serveur avant le `throw new ActionError(...)`.
- Frontières Biome (`noRestrictedImports`) : l'infra vit dans `src/lib/`,
  le middleware source dans `features/browser/server/` (pas de
  cross-feature).
- Prisma uniquement dans `src/lib/dal/`.
