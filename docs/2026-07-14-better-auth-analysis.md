# Analyse d'architecture — sécuriser Bucket UI avec better-auth

> Document d'analyse (pas d'implémentation). Basé sur better-auth **v1.6.23**
> (doc officielle), Next.js **16.2.10** (doc embarquée dans `node_modules`),
> Prisma **7.8**. Sources en fin de document.

## 1. Contexte et objectif

Aujourd'hui l'application n'a **aucune authentification** : le modèle de
sécurité repose entièrement sur un reverse proxy authentifiant (documenté
dans ARCHITECTURE.md). Conséquences :

- Toutes les routes GET (`/api/sources/[id]/*` : listing, preview, download,
  share, config) sont ouvertes à quiconque atteint l'app.
- Les server actions sont des endpoints POST publics ; seules les permissions
  par source (`allowUpload`/`allowDelete`) sont vérifiées côté serveur —
  aucune identité.
- L'audit trail attribue les écritures via les headers `x-forwarded-*` du
  proxy, en best-effort.

Objectif : une authentification **intégrée à l'app** (email + mot de passe,
comptes gérés par un admin), qui protège **toutes les entrées serveur**
(pages RSC, server actions, route handlers), sans casser l'architecture mise
en place (DAL, `ActionResult`, `withWriteAccess`, features).

## 2. Pourquoi better-auth

- Self-hosted, TypeScript-first, framework-agnostique, adapter Prisma
  officiel — colle à la stack (Next 16 + Prisma 7 + PostgreSQL).
- Sessions **en base** (table `Session`) → révocables ; cookies httpOnly,
  Secure, SameSite=Lax.
- Plugin **admin** officiel : rôles `user`/`admin`, création d'utilisateurs
  par l'admin, bannissement, révocation de sessions — exactement le besoin
  d'une petite app d'équipe, sans construire un backoffice.
- `emailAndPassword.disableSignUp: true` + `auth.api.createUser` (admin) =
  mode **invitation only** : pas d'inscription publique.
- Doc dédiée Next.js 16+ (handler App Router, `proxy.ts`, plugin
  `nextCookies` pour les server actions).

Alternatives écartées : NextAuth/Auth.js (orienté OAuth, gestion
d'utilisateurs locale plus laborieuse), Lucia (dépréciée en tant que lib),
rester sur le proxy seul (aucune granularité par utilisateur, pas d'audit
fiable).

## 3. Impact sur l'architecture, couche par couche

### 3.1 Schéma Prisma

`npx auth generate` (le nouveau Auth CLI ; ex-`@better-auth/cli`) ajoute les
modèles **User, Session, Account, Verification** dans `prisma/schema.prisma`
(le plugin admin ajoute `role`, `banned`, `banReason`, `banExpires` sur User
et `impersonatedBy` sur Session). La migration reste chez nous :
`pnpm db:migrate` (le CLI better-auth ne migre pas avec Prisma — génération
seulement).

> Note : le client généré obsolète supprimé pendant le refactoring contenait
> déjà ces modèles — c'était une tentative better-auth abandonnée. Le schéma
> repart proprement du generate officiel.

### 3.2 Instance serveur — `src/lib/auth.ts`

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  plugins: [admin(), nextCookies()], // nextCookies TOUJOURS en dernier
});
```

- Compatible avec notre singleton lazy (`Proxy` sur `globalThis`) : l'adapter
  prend une instance `PrismaClient`, peu importe sa construction.
- **Piège Prisma 7 documenté** : avec un `output` custom, importer le client
  depuis `@/generated/prisma/client`, jamais `@prisma/client` — déjà notre
  convention.
- `nextCookies()` est indispensable pour que les `set-cookie` émis dans des
  **server actions** (sign-in, sign-out) soient appliqués.
- Emplacement : `src/lib/auth.ts` respecte la frontière Biome « Prisma
  uniquement dans la DAL » ? Non — `prismaAdapter(prisma)` importe
  `@/lib/prisma`. Deux options : (a) ajouter `src/lib/auth.ts` à l'exception
  Biome aux côtés de `src/lib/dal/**` (c'est de l'infrastructure au même
  titre), ou (b) placer le fichier dans `src/lib/auth/` et élargir
  l'exception à ce dossier. Recommandation : **(b)** — un dossier
  `src/lib/auth/` (`auth.ts`, `client.ts`, `session.ts`) garde tout le
  périmètre auth au même endroit et l'exception lisible.

### 3.3 Route handler et client

- `src/app/api/auth/[...all]/route.ts` :
  `export const { GET, POST } = toNextJsHandler(auth)` (import
  `better-auth/next-js`).
- `src/lib/auth/client.ts` : `createAuthClient()` de `better-auth/react`
  (hooks `useSession`, `signIn.email`, `signOut`, et `adminClient` pour la
  page d'administration).

### 3.4 La garde centrale — `src/lib/auth/session.ts` (server-only)

Le pattern officiel est `auth.api.getSession({ headers: await headers() })`
dans chaque entrée serveur. On le centralise en deux helpers `server-only`,
mémoïsés avec `React.cache()` (reco DAL officielle Next.js — une seule
lecture de session par requête) :

```ts
import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

/** Pages RSC : redirige vers /sign-in. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** Actions et routes : retourne null, l'appelant répond 401/ActionResult. */
export async function currentUser() {
  return (await getSession())?.user ?? null;
}
```

### 3.5 Sécuriser chaque type d'entrée (défense en profondeur)

C'est le point clé : **un check au niveau page ne protège ni les actions ni
les routes** (doc Next.js « Data Security ») — chaque entrée revalide.

| Entrée | Garde | Échec |
|---|---|---|
| Pages RSC (`/`, `/activity`, `/source/[id]`) | `requireSession()` en tête | `redirect("/sign-in")` |
| Server actions (11) | `currentUser()` en tête ; pour les writes browser, intégré dans `withWriteAccess` (un seul endroit) | `actionError("Unauthorized.")` |
| Routes GET `/api/sources/[id]/*` (8) | `currentUser()` en tête de chaque `GET`/`POST` | `apiError(401, "Unauthorized.")` |
| `/api/health` | reste public (probe Docker) | — |
| `proxy.ts` (ex-middleware, Next 16) | `getSessionCookie(request)` → redirect `/sign-in` | **UX seulement** |

Sur `proxy.ts` : Next 16 renomme `middleware.ts` en `proxy.ts` (runtime Node
par défaut). La doc better-auth est explicite : le check cookie y est
**optimiste, pas une frontière de sécurité** (« THIS IS NOT SECURE! ») — il
évite juste le flash de contenu avant redirection. La vraie validation reste
dans les pages/actions/routes. Matcher : tout sauf `/sign-in`, `/api/auth/*`
et `/api/health`.

Concrètement, le gros du travail est mécanique et petit :
`withWriteAccess` (1 fichier) couvre les 7 actions browser ; les 4 actions
sources et les 8 routes gagnent 2 lignes chacune ; les 3 pages une ligne.
`ActionResult` et `apiError` absorbent les échecs sans nouveau concept.

### 3.6 Audit trail

`currentActor()` (`src/lib/dal/operations.ts`) lit aujourd'hui les headers
proxy. Évolution : `session.user.email` (ou name) en priorité, fallback sur
les headers `x-forwarded-*` pour compat, puis suppression du fallback une
fois better-auth en place. Optionnel : colonne `userId` sur `Operation` pour
un lien fort (l'actor dénormalisé reste, l'historique survit à la
suppression d'un compte).

### 3.7 UI

- Route group `src/app/(auth)/sign-in/page.tsx` avec layout minimal (pas de
  sidebar) ; formulaire via le kit TanStack Form + `authClient.signIn.email`.
- Menu utilisateur dans la sidebar (email, sign out).
- Page `/admin/users` (RSC + composants feature `src/features/users/`) :
  liste, création (invitation), rôle, ban, révocation de sessions — le tout
  via les endpoints du plugin admin (`auth.api.createUser`, `listUsers`,
  `setRole`, `banUser`…), exposés par nos server actions `ActionResult`
  habituelles (gardées par un `requireAdmin()`).
- Bootstrap du premier admin : `adminUserIds: [...]` dans la config, ou
  `UPDATE "user" SET role = 'admin'` après le premier compte. Pour du
  self-host reproductible : seed au boot piloté par env
  (`ADMIN_EMAIL`/`ADMIN_PASSWORD` consommés une fois), à trancher à
  l'implémentation.

## 4. Modèle d'autorisation

better-auth ne fournit **pas d'ACL par ressource** (confirmé) : le plugin
admin donne des rôles globaux et `createAccessControl` du RBAC par *type*
d'action — pas « l'utilisateur X voit la source Y ».

**Phase 1 (suffisant au départ)** : deux rôles.
- `user` : voit toutes les sources, lit tout ; écrit là où
  `allowUpload`/`allowDelete` sont actifs (comportement actuel, mais
  authentifié).
- `admin` : gère les sources (create/update/remove) et les utilisateurs.
  → Les actions sources passent de « ouvertes » à `requireAdmin()`.

**Phase 2 (optionnelle, si le besoin apparaît)** : accès par source.
- Table de jointure maison `SourceAccess(userId, sourceId)` (pattern
  communautaire standard, pas de mécanisme better-auth).
- Check dans la **DAL** : `listSources`/`getSource` prennent le user courant
  et filtrent ; les admins bypassent. Comme toute la donnée passe par la DAL
  (règle déjà enforced par Biome), ce filtre couvre mécaniquement pages,
  actions et routes — c'est le dividende direct du refactoring.

Les permissions d'écriture par source (`allowUpload`/`allowDelete`) restent
telles quelles : elles répondent à « que peut-on faire sur cette source »,
l'auth répond à « qui êtes-vous », la phase 2 à « qui voit quoi ».

## 5. Configuration et déploiement

- **Env** (à ajouter dans `src/lib/env.ts`, validées au boot par
  `instrumentation.ts`) : `BETTER_AUTH_SECRET` (≥ 32 chars) et
  `BETTER_AUTH_URL` (URL publique).
- **Derrière Traefik/Dokploy (TLS terminé au proxy)** : fixer
  `BETTER_AUTH_URL` en `https://…` suffit pour que le cookie soit `Secure` ;
  si multi-domaines, `advanced.trustedProxyHeaders: true` fait dériver la
  base URL de `X-Forwarded-Host`/`X-Forwarded-Proto`.
- **trustedOrigins** : allowlist anti-CSRF (le domaine public + localhost en
  dev).
- Le middleware basicAuth du proxy devient **inutile** (le README devra
  être mis à jour — c'est un changement de modèle de sécurité assumé, à
  noter dans le changelog de release).
- Docker : rien de structurel (les tables arrivent par
  `prisma migrate deploy` au boot, comme aujourd'hui).

## 6. Pièges connus (issus de la recherche)

1. **Prisma 7 + output custom** : importer le client depuis
   `@/generated/prisma/client` dans la config better-auth, sinon échec au
   runtime (documenté).
2. **`@prisma/adapter-pg` + Next 16** : une discussion GitHub (#6529)
   rapporte un `P1010` au runtime avec ce trio — cause côté URL/credentials
   pg, pas un bug better-auth confirmé, mais à tester tôt (phase 0).
3. **Cookie cache en RSC** : la session lue en RSC peut être servie du cache
   cookie tant qu'aucune interaction client n'a lieu — ne jamais s'appuyer
   sur un RSC seul pour une décision de sécurité (de toute façon couvert par
   les gardes action/route).
4. **`nextCookies()` en dernier** dans `plugins: []`, sinon les set-cookie
   des server actions se perdent.
5. **CLI** : `npx auth generate` (nouveau nom) ; `migrate` ne supporte pas
   Prisma — toujours passer par `prisma migrate dev`.

## 7. Plan de migration proposé (chaque phase livrable)

| Phase | Contenu | Taille estimée |
|---|---|---|
| **P0 — Fondations** | deps (`better-auth`), `npx auth generate`, migration Prisma, `src/lib/auth/` (config + client + session helpers), route `[...all]`, env + validation boot. Test tôt du trio adapter-pg/Next16 (piège n°2). | ~½ journée |
| **P1 — Verrouillage** | Gardes sur les 3 pages, 11 actions (`withWriteAccess` + sources), 8 routes ; `proxy.ts` optimiste ; page `/sign-in` ; menu user sidebar ; `currentActor()` → session. **À la fin de P1, plus rien n'est accessible sans compte.** | ~1 journée |
| **P2 — Administration** | Plugin admin : page `/admin/users` (feature `users/`), création par invitation (`disableSignUp` + `createUser`), rôles, ban ; actions sources réservées aux admins ; bootstrap premier admin. | ~1 journée |
| **P3 — Accès par source** (optionnel) | Table `SourceAccess`, filtres DAL, UI d'affectation dans le form source. | ~1 journée |
| **P4 — API keys** (optionnel, si accès programmatique) | Plugin api-key (attention : package scoped `@better-auth/api-key` depuis l'extraction 2026). | à la demande |

Risques principaux : le piège n°2 (à lever en P0), et la migration des
déploiements existants (les instances derrière basicAuth devront créer leur
premier admin — à documenter dans les notes de release).

## 8. Sources

- better-auth × Next.js (proxy.ts Next 16, nextCookies, getSession) :
  https://www.better-auth.com/docs/integrations/next — officiel
- Adapter Prisma (+ piège output Prisma 7) :
  https://www.better-auth.com/docs/adapters/prisma — officiel
- Guide Prisma officiel better-auth + Next.js :
  https://www.prisma.io/docs/guides/betterauth-nextjs — officiel
- Plugin admin (rôles, createUser, ban, access control) :
  https://www.better-auth.com/docs/plugins/admin — officiel
- Options (`emailAndPassword.disableSignUp`, `trustedOrigins`,
  `advanced.trustedProxyHeaders`) :
  https://www.better-auth.com/docs/reference/options — officiel
- Sécurité (secret, cookies, sessions) :
  https://www.better-auth.com/docs/reference/security — officiel
- CLI (`auth generate`, pas de migrate Prisma) :
  https://www.better-auth.com/docs/concepts/cli — officiel
- Next 16 `proxy.ts` : doc embarquée
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — officiel
- Next.js Data Security (revalider dans chaque action/route, DAL) : doc
  embarquée `01-app/02-guides/data-security.md` — officiel
- P1010 adapter-pg :
  https://github.com/better-auth/better-auth/discussions/6529 — communautaire
- disableSignUp + admin.createUser :
  https://github.com/better-auth/better-auth/issues/5724 — communautaire
- Pattern table de jointure pour l'accès par ressource : consensus
  communautaire (pas de mécanisme natif better-auth).
