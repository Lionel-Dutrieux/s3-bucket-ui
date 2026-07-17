# Runtime SMTP / OIDC configuration (Admin UI) — design

Date : 2026-07-17
Statut : validé en brainstorming, en attente de plan d'implémentation

## Contexte

Aujourd'hui SMTP et OIDC ne se configurent que par variables d'environnement
(`src/lib/env.ts`), lues une seule fois : `mail.ts` lit `env` directement et
`auth.ts` fige le provider OIDC dans le singleton `betterAuth()` au chargement
du module. Un admin non-ops ne peut donc rien configurer sans accès au
déploiement.

Ce chantier est la fondation des chantiers V1 suivants (invitations par email,
vérification d'email), qui dépendent tous d'un SMTP opérationnel.

## Objectif

Rendre SMTP et OIDC éditables depuis **Admin → Settings**, avec les variables
d'environnement comme **valeurs par défaut**, et une prise d'effet **à chaud**
(sans redémarrage), y compris pour OIDC.

## Non-objectifs

- Audit des actions admin, invitations, vérification d'email, 2FA (specs
  suivantes).
- Multi-providers OIDC (un seul provider, id `"oidc"`, comme aujourd'hui).
- Édition des autres variables d'env (DATABASE_URL, secrets d'app, etc.).

## Sémantique de précédence

**DB > env, champ par champ.**

- L'env fournit la valeur par défaut de chaque champ ; une valeur sauvegardée
  en DB la surcharge individuellement.
- Le formulaire affiche la valeur effective avec un badge de provenance
  (« env » / « personnalisé »).
- Un bouton « Rétablir les valeurs d'environnement » par carte supprime les
  clés DB du groupe (retour intégral aux défauts env).

## Modèle de données

Table `Setting` key-value existante (comme les toggles et le branding) —
aucune migration de schéma. Clés :

- `smtp.host`, `smtp.port`, `smtp.secure`, `smtp.user`, `smtp.password`
  (chiffré), `smtp.from`
- `oidc.discoveryUrl`, `oidc.clientId`, `oidc.clientSecret` (chiffré),
  `oidc.providerLabel`, `oidc.scopes`, `oidc.groupsClaim`
- `configVersion` : entier incrémenté à chaque sauvegarde/reset SMTP ou OIDC
  — témoin d'invalidation de l'instance better-auth.

Les secrets (`smtp.password`, `oidc.clientSecret`) sont chiffrés avec
`lib/crypto.ts` (AES-256-GCM via `ENCRYPTION_KEY`), comme les clés S3 des
sources. Ils ne sont **jamais renvoyés au client** : le formulaire affiche un
placeholder « configuré » et ne réécrit le secret que si l'admin en saisit un
nouveau (pattern identique aux credentials des sources).

## Couche config — `src/lib/config/`

Nouveau module d'infra partagée (même statut que `lib/storage/`) :

- `getSmtpConfig(): Promise<SmtpConfig | null>` — fusion champ par champ
  DB > env (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
  `SMTP_PASSWORD`, `SMTP_FROM`), déchiffrement du mot de passe. `null` si ni
  la DB ni l'env ne fournissent le couple host + from (règle actuelle de
  `smtpEnabled()`).
- `getOidcConfig(): Promise<OidcConfig | null>` — idem pour
  `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`,
  `OIDC_PROVIDER_LABEL`, `OIDC_SCOPES`, `OIDC_GROUPS_CLAIM`. `null` si le
  trio discoveryUrl/clientId/clientSecret est incomplet.
- `getConfigProvenance()` — par champ, `"db" | "env" | "unset"`, pour les
  badges du formulaire (sans jamais exposer la valeur des secrets).

Conséquences :

- `src/lib/mail.ts` appelle `getSmtpConfig()` à chaque envoi (transporteur
  construit à la volée) → effet immédiat.
- `smtpEnabled()` / `oidcEnabled()` deviennent asynchrones et résolvent
  DB + env ; les call sites (visibilité du « Forgot password? », bouton SSO
  de la page de connexion, gating du `sendResetPassword`) sont adaptés.
- `assertSmtpEnv` / `assertOidcEnv` (boot) restent : une env partielle reste
  une erreur de déploiement ; la complétude d'une config DB est garantie par
  la validation des actions.

## Better-auth reconstruit à chaud

`src/lib/auth/auth.ts` passe d'un `export const auth` à une fabrique
versionnée :

- `getAuth(): Promise<Auth>` compare `configVersion` (DB) à la version de
  l'instance en cache ; si différente, reconstruit `betterAuth({...})` avec
  le provider issu de `getOidcConfig()` (via `buildOidcProvider` adapté dans
  `oidc.ts`).
- La lecture de `configVersion` est cachée **~5 s** (TTL en mémoire) pour ne
  pas ajouter une requête DB à chaque hit d'auth. Fenêtre de 5 s entre
  sauvegarde et prise d'effet : acceptée.
- Call sites migrés vers `await getAuth()` : `app/api/auth/[...all]/route.ts`,
  `src/lib/auth/session.ts`, les actions admin qui appellent `auth.api.*`, et
  tout autre import du singleton. Refactor diffus mais mécanique.
- Le reste de la config better-auth (rate limits, hooks, databaseHooks,
  plugin admin) est inchangé et reconstruit à l'identique.

## UI admin

Page **Admin → Settings** : deux nouvelles cartes sous les cartes existantes
(toggles, branding), en onglets si la page devient trop longue. Kit TanStack
Form (`useAppForm`) obligatoire.

**Carte Email (SMTP)** : host, port, secure (switch), user, password
(write-only), from ; badges de provenance ; « Rétablir les valeurs
d'environnement » ; bouton « Envoyer un email de test » (envoi à l'adresse de
l'admin connecté).

**Carte Single Sign-On (OIDC)** : discovery URL, client ID, client secret
(write-only), libellé du bouton, scopes, claim des groupes ; badges ; reset ;
rappel de l'URL de callback à déclarer chez l'IdP
(`{BETTER_AUTH_URL}/api/auth/oauth2/callback/oidc`) ; avertissement avant
d'activer OIDC-only (tester le SSO dans une fenêtre privée d'abord).

## Server actions

Dans `src/features/admin/actions.ts`, toutes via `withAdmin` + zod +
`ActionResult` :

- `updateSmtpSettings`, `resetSmtpSettings`
- `updateOidcSettings`, `resetOidcSettings`
- `sendTestEmail`

Chaque update/reset incrémente `configVersion` dans la même transaction.

## Validation et erreurs

- Zod : port 1-65535, discovery URL en URL, `from` non vide, etc.
- Sauvegarde SMTP : pas de test de connexion bloquant (rôle du bouton de
  test) ; l'email de test remonte l'erreur SMTP réelle dans le toast.
- Sauvegarde OIDC : fetch du discovery document
  (`/.well-known/openid-configuration`) avant acceptation — échec = erreur de
  formulaire, aucune config cassée ne rentre en base.
- Anti-lockout : le toggle « OIDC only » existant refuse de s'activer si
  `getOidcConfig()` est incomplet (règle déjà en place, réévaluée sur la
  config résolue DB + env).

## i18n

Toutes les nouvelles chaînes dans les 5 fichiers `messages/*.json`
(en, fr, de, es, zh), zéro clé manquante.

## Tests

- `lib/config` : précédence env/DB champ par champ, déchiffrement, `null`
  quand incomplet, provenance.
- `getAuth()` : réutilisation de l'instance à version égale, reconstruction
  sur incrément, TTL.
- Schémas zod des nouvelles actions.
- Vérification : `pnpm typecheck && pnpm lint && pnpm test && pnpm build` ;
  test UI manuel par l'utilisateur (pas d'E2E automatisé).
