# Design spec — 2FA (TOTP + codes de secours) via better-auth

**Chantier 3/5 de la roadmap V1 « entreprise ».** Date : 2026-07-17.
Statut : design validé (périmètre choisi), prêt pour le plan d'implémentation.

## 1. Contexte & intention

L'app a une auth better-auth (email/password + OIDC SSO, plugin `admin`), mais
aucun second facteur. Pour une V1 « entreprise » crédible, on veut permettre à
un utilisateur de protéger son compte par TOTP (Google Authenticator, 1Password,
Aegis…), avec des codes de secours en filet.

Le plugin `twoFactor` de better-auth (v1.6.23, déjà dans `node_modules`) fournit
toute la mécanique serveur + client. Le travail est : brancher le plugin, migrer
la DB, et construire l'UX (activation sur la page compte + étape de défi au
sign-in).

## 2. Périmètre (décidé)

- **Méthode** : TOTP uniquement comme second facteur, + **10 codes de secours**
  à usage unique générés à l'activation. Pas d'OTP email (évite la dépendance
  SMTP pour le facteur lui-même ; reste un follow-up possible).
- **Application** : **opt-in par utilisateur**. Chaque utilisateur disposant d'un
  mot de passe active/désactive le 2FA depuis sa page compte. Pas d'obligation
  admin en V1 (follow-up documenté).
- **« Se souvenir de cet appareil »** : activé (30 jours, `trustDevice`,
  intégré au plugin) — évite de redemander le code à chaque connexion.
- **Comptes OIDC-only** : le 2FA ne s'applique pas (pas de mot de passe local).
  La section est masquée exactement comme la section « Mot de passe »
  (`hasPassword && !oidcOnly`, cf. `account/page.tsx:66`).

Hors périmètre V1 (follow-ups) : OTP email comme facteur, obligation admin de
2FA, passkeys/WebAuthn, action admin de réinitialisation du 2FA d'un utilisateur.

## 3. Contrainte dure

`twoFactor()` **doit être inséré avant `nextCookies()`** dans le tableau
`plugins` de `buildAuth` (`auth.ts:166-172`), sinon l'étape de vérification ne
peut pas poser le cookie de session dans un contexte server-action.

Le plugin est **statique** (pas piloté par la DB comme OIDC) : il est ajouté
inconditionnellement et présent dans chaque instance reconstruite par
`getAuth()` (TTL 5 s). Aucun câblage `configVersion` supplémentaire. L'état
(secret, codes, compteur d'échecs, lockout) vit en DB → transparent aux
reconstructions.

## 4. Modèle de données (Prisma)

`prisma/schema.prisma` (better-auth models maintenus à la main, cf. commentaire
`schema.prisma:46`) :

- **User** : ajouter `twoFactorEnabled Boolean? @default(false)
  @map("two_factor_enabled")` + relation `twoFactors TwoFactor[]`.
- **Nouveau modèle `TwoFactor`** (`@@map("two_factor")`) : `id` (text),
  `userId` (FK → user, `onDelete: Cascade`, indexé), `secret`, `backupCodes`,
  `verified Boolean @default(true)`, `failedVerificationCount Int @default(0)`,
  `lockedUntil DateTime?` (timestamptz). Colonnes exactes exigées par
  `two-factor/schema.d.mts`.

Migration : **Prisma uniquement** (`pnpm db:migrate` → nouvelle migration sous
`prisma/migrations/`). La CLI `@better-auth/cli` n'est pas utilisée et ne
fonctionne pas avec l'adaptateur Prisma. Régénérer le client Prisma.

## 5. Serveur

`src/lib/auth/auth.ts` — dans `buildAuth`, plugins array **avant** `nextCookies()` :

```ts
twoFactor({
  issuer: env.APP_NAME ?? "Bucket UI", // libellé dans l'app d'authentification
  // TOTP 6 chiffres / 30 s (défauts) ; 10 codes de secours (défaut)
})
```

`issuer` reste statique (nom d'app) → pas besoin de le lire en DB ni de bumper
`configVersion`. Le plugin ajoute automatiquement ses propres rate-limits
`/two-factor/*` et le champ `user.twoFactorEnabled` (via son schéma) ; les types
`Session`/`SessionUser` (inférés de `getAuth()`) exposent alors
`twoFactorEnabled` sans plomberie manuelle.

Aucune nouvelle server action : comme tout l'auth existant (signIn,
changePassword), les appels 2FA passent par `authClient` côté client. Les
endpoints `/two-factor/*` sont servis automatiquement par le handler
`[...all]/route.ts` une fois le plugin enregistré.

## 6. Client

`src/lib/auth/client.ts` — ajouter `twoFactorClient()` au tableau `plugins`
(import `better-auth/client/plugins`). Pas d'option `twoFactorPage`
/`onTwoFactorRedirect` : on gère la redirection explicitement dans le
sign-in-form (cohérent avec le code existant qui inspecte déjà la réponse).

## 7. UX

### a) Défi au sign-in
`src/features/auth/components/sign-in-form.tsx:39-49` — après `signIn.email`,
si `data?.twoFactorRedirect` est vrai, `router.push("/two-factor")` au lieu de
`router.push("/")`.

Nouvelle page **`src/app/(auth)/two-factor/page.tsx`** (groupe `(auth)`, à côté
de sign-in) + composant client `TwoFactorChallengeForm` (modelé sur
`sign-in-form.tsx`) :
- champ code → `authClient.twoFactor.verifyTotp({ code, trustDevice })` +
  case à cocher « se souvenir de cet appareil ».
- lien « utiliser un code de secours » → `authClient.twoFactor.verifyBackupCode({ code })`.
- succès → `router.push("/"); router.refresh()`.

### b) Activation sur la page compte
`src/app/(app)/account/page.tsx` — nouvelle `<section>` « Authentification à deux
facteurs », **gate `hasPassword && !oidcOnly`** (même condition que la section
mot de passe), lisant `session.user.twoFactorEnabled`.

Composant client `TwoFactorSetupForm` (modelé sur `change-password-form.tsx`,
même kit `useAppForm` + `FormAlert` + `toast`) :
- **Désactivé → activer** : saisir le mot de passe →
  `twoFactor.enable({ password })` → retourne `{ totpURI, backupCodes }` →
  afficher le **QR** (`qrcode.react`) + la clé manuelle en fallback + la liste
  des codes de secours (à copier/télécharger) → l'utilisateur saisit un code de
  l'app → `twoFactor.verifyTotp({ code })` confirme et bascule l'état à activé.
- **Activé → désactiver** : saisir le mot de passe →
  `twoFactor.disable({ password })`.
- **Régénérer les codes de secours** : mot de passe →
  `twoFactor.generateBackupCodes({ password })`.

Les endpoints `enable/disable/getTotpUri/generateBackupCodes` **exigent le mot de
passe** dans le body — d'où le gate `hasPassword`.

### c) Dépendance
**`qrcode.react`** (nouvelle dépendance, petite, standard) pour rendre le
`otpauth://` en QR côté client. La clé manuelle est toujours affichée en
fallback (bonne pratique + accessibilité). C'est la seule nouvelle dépendance.

## 8. i18n

Nouveau bloc `twoFactor.*` (labels d'activation, QR, codes de secours, défi,
erreurs) dans **les 5 locales** `messages/{en,fr,de,es,zh}.json`, comme le
chantier config. Modules `lib/` purs : jamais de texte résolu.

## 9. Vérification

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` vert.
- Tests unitaires sur toute logique pure ajoutée (peu attendu — le gros passe
  par le plugin). Le schéma zod du formulaire de défi/activation est testable.
- **Test manuel** (l'utilisateur teste l'UI) : activer le 2FA (scanner le QR,
  confirmer un code), se déconnecter/reconnecter → défi TOTP, « trust device »,
  code de secours, désactivation. `pnpm db:migrate` appliqué au préalable.

## 10. Risques / bords

- **Perte de l'app + des codes** → lock-out utilisateur. En V1, la récupération
  passe par un admin en DB. **Follow-up recommandé** : action admin
  `disableUserTwoFactor(userId)` (le plugin expose `viewBackupCodes`/
  `disableTwoFactor` côté `auth.api`) pour dé-bloquer proprement.
- Rate-limit en mémoire réinitialisé à chaque reconstruction `getAuth()` —
  déjà connu et accepté (`auth.ts:66-69`).
- Migration DB obligatoire avant déploiement (`db:deploy` en prod).
