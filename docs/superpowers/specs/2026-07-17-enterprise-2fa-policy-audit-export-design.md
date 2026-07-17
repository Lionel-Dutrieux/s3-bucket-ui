# Enterprise readiness — politique 2FA org-wide + audit (downloads / export / rétention)

Date : 2026-07-17
Statut : design approuvé, prêt pour writing-plans

Deux features indépendantes livrées ensemble sous le thème « enterprise
readiness ». Elles partagent des points de contact (`SettingsForm`, i18n,
DAL `settings.ts`) mais n'ont aucune dépendance fonctionnelle l'une envers
l'autre. Elles peuvent être planifiées et implémentées en séquence.

Contraintes globales (rappel des conventions du repo, cf. `ARCHITECTURE.md`) :

- Reads : RSC d'abord, sinon route GET. Jamais de server action en lecture.
- Mutations : server actions renvoyant `ActionResult`, input validé zod,
  permissions re-vérifiées côté serveur (`withAdmin` pour les actions admin).
- Prisma uniquement dans `src/lib/dal/`.
- i18n : chaque string UI via next-intl, clés présentes dans **les 5**
  locales (`de`, `en`, `es`, `fr`, `zh`). Les modules `lib/` purs exposent
  des clés, jamais du texte résolu.
- Auth : chaque entrée serveur re-valide. `proxy.ts` est optimiste, jamais
  un garde.
- Vérif : `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. L'UI est
  testée manuellement par l'utilisateur.

---

## Feature #1 — Politique 2FA au niveau org

### Objectif

Permettre à un admin d'**exiger** le 2FA (aujourd'hui opt-in par
utilisateur) pour tous les comptes, ou seulement les admins. But réel :
qu'à terme tous les logins concernés soient protégés par un second facteur.

### Réglage & DAL

Nouvelle clé de settings `twoFactorPolicy` avec trois valeurs :

- `off` (défaut) — aucun enforcement.
- `admins` — 2FA exigé pour les comptes `role === "admin"`.
- `all` — 2FA exigé pour tous les comptes.

Dans `src/lib/dal/settings.ts` :

```ts
export type TwoFactorPolicy = "off" | "admins" | "all";
export async function getTwoFactorPolicy(): Promise<TwoFactorPolicy>;
export async function setTwoFactorPolicy(policy: TwoFactorPolicy): Promise<void>;
```

Stockage : réutilise le pattern `setting` clé/valeur (string). Lecture
tolérante : toute valeur inconnue ou absente → `off`.

### Règle « qui est concerné »

Un helper pur détermine si un utilisateur doit être enrôlé :

```ts
// dans src/lib/authz/ (module pur, pas de Prisma)
function twoFactorRequiredFor(
  user: { role: string | null },
  policy: TwoFactorPolicy,
): boolean {
  if (policy === "all") return true;
  if (policy === "admins") return user.role === "admin";
  return false;
}
```

**Comptes OIDC (décision figée).** Le 2FA de better-auth est *password-based*
(`twoFactor.enable` exige le mot de passe). Un compte purement SSO n'a pas de
credential mot de passe et ne peut donc pas s'enrôler.

- En **mode OIDC-only** (`isOidcOnly() === true`) : le contrôle de politique
  est masqué dans l'UI admin et l'enforcement est court-circuité (le 2FA est
  délégué à l'IdP). Le gate ne s'active jamais dans ce mode.
- En **mode mixte** : l'enforcement ne s'applique qu'aux comptes possédant un
  credential mot de passe. Nouveau helper DAL :

  ```ts
  // src/lib/dal/users.ts (ou accounts.ts)
  export async function hasPasswordCredential(userId: string): Promise<boolean>;
  // true si prisma.account a une ligne providerId === "credential" pour ce user
  ```

  Un compte SSO sans mot de passe passe donc sans être bloqué (jamais de
  cul-de-sac).

### Enforcement (gate)

Point unique : le layout `src/app/(app)/layout.tsx`, qui appelle déjà
`requireSession()` et enveloppe toutes les pages authentifiées (y compris
`/admin/*`). Après récupération de la session :

```
policy = await getTwoFactorPolicy()
if (policy !== "off"
    && !(await isOidcOnly())
    && twoFactorRequiredFor(session.user, policy)
    && session.user.twoFactorEnabled === false
    && await hasPasswordCredential(session.user.id)) {
  redirect("/setup-2fa")
}
```

C'est un gate UX/policy, cohérent avec le pattern existant (« un layout ne
protège rien de critique par lui-même »). Sa finalité — amener les comptes
concernés à s'enrôler — est atteinte au niveau UI ; il ne s'agit pas d'une
frontière de sécurité par requête.

`session.user.twoFactorEnabled` est déjà exposé par le plugin `twoFactor`
(cf. l'ordre des plugins dans `auth.ts`).

### Nouvelle route `/setup-2fa`

Doit vivre **hors** du groupe `(app)` (sinon boucle de redirection) et
**hors** du groupe `(auth)` (dont le layout redirige tout utilisateur
connecté vers `/`). Solution : nouveau groupe de route `(gate)` contenant
`setup-2fa/`, avec un layout minimal (pas de sidebar) qui :

- exige une session (`requireSession()`), sinon redirige `/sign-in` ;
- si l'utilisateur a déjà `twoFactorEnabled === true`, redirige vers `/`
  (rien à faire ici) ;
- rend la page d'enrôlement.

La page réutilise `TwoFactorSetupForm` (flux enable → confirm TOTP) et
ajoute un bouton de déconnexion (échappatoire). Après le `verifyTotp`
réussi, redirection vers `/`.

`TwoFactorSetupForm` reçoit une nouvelle prop optionnelle
`redirectOnEnabled?: string` : quand fournie, après le succès de
`verifyTotp` (étape 2, celle qui bascule réellement `twoFactorEnabled` à
true), le composant fait `router.push(redirectOnEnabled)` au lieu de
simplement passer à l'écran « désactiver ». Comportement inchangé dans
`/account` (prop absente).

`proxy.ts` : `/setup-2fa` n'a pas besoin d'être exempté — l'utilisateur est
connecté, le cookie de session est présent, le check optimiste passe.

### UI admin

Dans `SettingsForm`, remplacer le pattern toggle par un contrôle 3 états
pour cette option (les autres réglages restent des toggles). Un `Select`
(shadcn) avec les trois valeurs, libellées via i18n. Masqué entièrement
quand `oidcOnly === true` (afficher à la place une ligne désactivée
expliquant que le 2FA est géré par l'IdP, ou masquer la ligne — au choix de
l'implémenteur, décrit dans le plan).

Quand l'admin **durcit** la politique (`off`→`admins`/`all`, ou
`admins`→`all`), un `ConfirmDialog` avertit : « Les comptes concernés
seront invités à configurer le 2FA à leur prochaine navigation. »

La page `src/app/(app)/admin/settings/page.tsx` charge
`getTwoFactorPolicy()` et le passe à `SettingsForm`, plus `oidcConfigured`
déjà disponible.

### Action

```ts
// src/features/admin/actions.ts
export async function setTwoFactorPolicy(policy: string): Promise<ActionResult>;
// withAdmin, zod z.enum(["off","admins","all"]), puis DAL setTwoFactorPolicy.
```

### i18n

Nouvelles clés dans `admin.settingsForm` (titre, description, libellés des 3
options, texte de confirmation, toasts) et `admin.errors` si besoin —
ajoutées dans **de/en/es/fr/zh**.

### Cas limites

- Admin qui active `all` sans avoir lui-même de 2FA : à sa prochaine
  navigation il est redirigé vers `/setup-2fa` (comportement correct et
  voulu ; le `ConfirmDialog` l'a prévenu).
- Session sans `twoFactorEnabled` typé : garanti présent par l'ordre des
  plugins ; si `undefined`, traiter comme `false`.

---

## Feature #2 — Audit : logging des downloads + export + rétention

### Objectif

Rendre la piste d'audit crédible pour la compliance : tracer les
**téléchargements** (pas seulement les mutations), permettre l'**export**
(CSV/JSON) et appliquer une **rétention** configurable.

### 2a. Logging des downloads

Décision figée : downloads **réels uniquement** (pas de preview, pas de
thumbnail). Trois nouvelles `OperationAction` dans `operations.ts` :
`download`, `download-zip`, `share-download`.

Points d'ancrage (`recordOperation` après le contrôle d'accès, jamais
avant) :

- `src/app/api/sources/[id]/download/route.ts` — après `requireSourceAccess`
  réussi : action `download`, `target = key`. Logué à l'intention (le corps
  peut ensuite être servi par une URL présignée côté provider — on trace la
  demande d'accès, ce qui est le fait auditable).
- `src/app/api/sources/[id]/zip/route.ts` — action `download-zip`,
  `target` = résumé lisible (préfixe ou nombre d'entrées), `detail`
  optionnel.
- `src/app/api/s/[token]/download/route.ts` — action `share-download`.
  Contexte **public** : pas de session, donc `recordOperation` enregistre
  `actor = null` / `userId = null`. Passer `detail` = « via lien de partage »
  (clé i18n côté UI, valeur brute stable côté log). `sourceId`/`sourceName`
  résolus depuis la share.

`recordOperation` reste inchangée (attribution via `getSession()`, ne throw
jamais). Elle gère déjà le cas `session == null` → acteur null.

Nouveaux libellés dans
`src/features/activity/lib/operation-labels.ts` (icône + `labelKey`,
non destructifs) et clés `activity.operations.*` dans les 5 locales.

### 2b. Export

Route GET admin-only :
`src/app/api/activity/export/route.ts` — `?format=csv|json` + reprise des
mêmes filtres que la vue (`action`, `source`, `q`). Re-valide via
`requireAdmin()` (route handler → renvoie 404/`apiError` si non-admin,
aligné sur le reste).

Nouvelle fonction DAL `exportOperations(filters)` : même `where` que
`listOperations` mais sans le plafond de 200 — cap de sécurité à 50 000
lignes (`orderBy createdAt desc`, `take: 50_000`). Si le cap est atteint, la
route ajoute un en-tête/entête de fichier signalant la troncature (et un
`console.warn`).

- `format=csv` : `Content-Type: text/csv`, `Content-Disposition:
  attachment; filename="audit-<date>.csv"`. Colonnes :
  `created_at` (ISO 8601), `action`, `source_name`, `target`, `detail`,
  `actor`. Échappement CSV correct (guillemets, virgules, retours ligne).
- `format=json` : `application/json`, tableau d'objets `OperationRecord`
  (dates en ISO).

Deux boutons dans l'en-tête de `src/app/(app)/activity/page.tsx`
(« Exporter CSV » / « Exporter JSON »), rendus comme liens `<a>` /
`buttonVariants` portant les filtres courants en query string. Cachés si 0
entrée.

### 2c. Rétention

Décision figée : purge **paresseuse à la lecture** de la vue audit,
throttlée à 1×/jour. Défaut **conserver indéfiniment** (opt-in).

Deux clés de settings :

- `auditRetentionDays` — entier ≥ 0. `0` = conserver indéfiniment (défaut).
- `auditLastPurgeAt` — timestamp epoch ms de la dernière purge (throttle).

DAL dans `settings.ts` :

```ts
export async function getAuditRetentionDays(): Promise<number>; // 0 si absent/invalide
export async function setAuditRetentionDays(days: number): Promise<void>;
```

DAL dans `operations.ts` :

```ts
export async function purgeExpiredOperations(): Promise<void>;
// 1. days = getAuditRetentionDays(); si days <= 0 → return.
// 2. lit auditLastPurgeAt ; si < 24h → return (throttle).
// 3. cutoff = now - days*86400_000 ; prisma.operation.deleteMany({ createdAt: { lt: cutoff } }).
// 4. écrit auditLastPurgeAt = now.
// Ne throw jamais (try/catch + console.error), comme recordOperation.
```

Appelée en tête de `ActivityPage` (RSC admin-only), **awaited** avant
`listOperations` (rapide : index sur `created_at`). Le throttle évite de
tourner à chaque navigation.

UI admin : dans `SettingsForm`, un `Select` de presets →
`Indéfiniment (0) / 30 / 90 / 180 / 365 jours`. Action :

```ts
// src/features/admin/actions.ts
export async function setAuditRetention(days: number): Promise<ActionResult>;
// withAdmin, zod z.union of allowed presets (0|30|90|180|365), DAL set.
```

La page settings charge `getAuditRetentionDays()` et le passe au form.

### i18n

Clés ×5 pour : libellés d'export (2 boutons), le réglage de rétention
(titre, description, libellés des presets, toast), et les 3 nouveaux
libellés d'opérations (`download`, `download-zip`, `share-download`).

### Cas limites

- Log volumineux à l'export : cap 50 000 + signal de troncature.
- Dates : toujours ISO 8601 dans CSV/JSON (pas de `formatRelative`).
- Purge concurrente (deux admins ouvrent la vue) : le throttle basé sur
  `auditLastPurgeAt` rend une double purge inoffensive (idempotente).
- Rétention passée de 0 à N : la première ouverture de la vue audit purge le
  backlog au-delà de N jours (attendu).

---

## Découpage suggéré pour le plan

Feature #1 et #2 sont indépendantes → deux blocs de tâches. Ordre proposé :
DAL + helpers d'abord (testables isolément), puis routes/enforcement, puis
UI + i18n, chaque bloc vérifié par `pnpm typecheck && lint && test`.

Ce qui n'est **pas** dans le scope (rappels explicites) : egress SIEM
(webhook/syslog), logging des previews/thumbnails, rétention par scheduler
cron, 2FA pour comptes SSO (délégué à l'IdP). YAGNI strict.
