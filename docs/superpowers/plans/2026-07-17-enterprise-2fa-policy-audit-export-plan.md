# Plan — Enterprise readiness : politique 2FA org-wide + audit (downloads/export/rétention)

Spec : `docs/superpowers/specs/2026-07-17-enterprise-2fa-policy-audit-export-design.md`
Mode : subagent-driven, **sans commit** (les implémenteurs codent + testent, ne commitent pas).

## Contraintes globales (à copier dans chaque brief reviewer)

- Prisma uniquement dans `src/lib/dal/`. Reads = RSC/route GET, jamais de server action en lecture.
- Mutations = server actions `ActionResult`, input zod, `withAdmin` pour l'admin.
- i18n : toute string UI via next-intl ; **toute** nouvelle clé ajoutée dans les 5 locales `de/en/es/fr/zh` (parité stricte). Modules `lib/` purs exposent des clés, pas de texte.
- Auth : chaque entrée serveur re-valide ; `proxy.ts` n'est pas un garde.
- Pas de commit. Vérif par tâche : `pnpm typecheck && pnpm lint && pnpm test` (build à la fin).
- YAGNI : hors scope = egress SIEM, preview/thumbnail logging, cron, 2FA pour comptes SSO.
- Note env : des erreurs `TS2589` préexistantes (users-table.tsx, browser-columns.tsx) viennent du compilateur local `@typescript/native-preview` ; ne pas les traiter comme des régressions.

---

## Feature #1 — Politique 2FA org-wide

### Task 1 — DAL + helpers (2FA policy)
Fichiers : `src/lib/dal/settings.ts`, `src/lib/dal/users.ts`, nouveau `src/lib/authz/two-factor-policy.ts` (+ test), `src/lib/authz/two-factor-policy.test.ts`.
- `settings.ts` : `type TwoFactorPolicy = "off"|"admins"|"all"` ; `getTwoFactorPolicy()` (valeur inconnue/absente → `off`) ; `setTwoFactorPolicy(policy)`. Réutilise le pattern `setting` string clé `twoFactorPolicy`.
- `users.ts` : `hasPasswordCredential(userId): Promise<boolean>` → `true` si `prisma.account` a une ligne `providerId === "credential"` pour ce user.
- `src/lib/authz/two-factor-policy.ts` : helper pur `twoFactorRequiredFor(user: {role: string|null}, policy: TwoFactorPolicy): boolean` (`all`→true ; `admins`→role==="admin" ; sinon false). Aucune dépendance Prisma.
- Tests unitaires sur `twoFactorRequiredFor` (les 3 policies × admin/user). Vitest.

### Task 2 — Route `/setup-2fa` + enforcement
Fichiers : nouveau groupe `src/app/(gate)/setup-2fa/page.tsx` + `src/app/(gate)/layout.tsx`, modif `src/app/(app)/layout.tsx`, modif `src/features/auth/components/two-factor-setup-form.tsx`.
- `(gate)/layout.tsx` : layout minimal (pas de sidebar). `requireSession()` sinon `/sign-in`.
- `(gate)/setup-2fa/page.tsx` : si `session.user.twoFactorEnabled === true` → `redirect("/")`. Sinon rend `<TwoFactorSetupForm enabled={false} redirectOnEnabled="/" />` + bouton de déconnexion (réutiliser le pattern sign-out existant du repo). Titre/intro via i18n (`twoFactor.gate.*`).
- `two-factor-setup-form.tsx` : nouvelle prop optionnelle `redirectOnEnabled?: string`. Dans `confirmForm.onSubmit`, **après** succès `verifyTotp`, si la prop est fournie → `router.push(redirectOnEnabled)` (importer `useRouter`) ; sinon comportement inchangé. Aucun changement pour `/account`.
- `(app)/layout.tsx` : après `requireSession()`, calculer le gate. Court-circuiter dans cet ordre (perf) :
  `policy = await getTwoFactorPolicy(); if (policy !== "off" && !session.user.twoFactorEnabled && twoFactorRequiredFor(session.user, policy) && !(await isOidcOnly()) && await hasPasswordCredential(session.user.id)) redirect("/setup-2fa");`
  (l'ordre garantit qu'un compte déjà enrôlé n'exécute aucune requête supplémentaire.)

### Task 3 — UI admin (2FA policy)
Fichiers : `src/features/admin/components/settings-form.tsx`, `src/app/(app)/admin/settings/page.tsx`, `src/features/admin/actions.ts`, `messages/{de,en,es,fr,zh}.json`.
- `actions.ts` : `setTwoFactorPolicy(policy: string): Promise<ActionResult>` via `withAdmin`, zod `z.enum(["off","admins","all"])`, puis DAL. Message d'échec réutilise `admin.errors.settingUpdateFailed`.
- `settings-form.tsx` : ajouter une ligne « politique 2FA » avec un `Select` (shadcn, `components/ui/select`) à 3 options. Quand l'admin **durcit** (off→admins/all ou admins→all), passer par un `ConfirmDialog` (composant existant) avec un texte d'avertissement avant d'appeler l'action. Masquer entièrement la ligne quand `oidcOnly === true`. Prop supplémentaire `twoFactorPolicy` + `oidcOnly` déjà dispo.
- `settings/page.tsx` : charger `getTwoFactorPolicy()` (Promise.all) et le passer au form.
- i18n : `admin.settingsForm.twoFactorPolicyTitle/Description`, `.twoFactorPolicyOff/Admins/All`, `.twoFactorPolicyConfirmTitle/Description`, `.twoFactorPolicyToast`, dans les 5 locales.

---

## Feature #2 — Audit downloads / export / rétention

### Task 4 — Logging des downloads
Fichiers : `src/lib/dal/operations.ts`, `src/app/api/sources/[id]/download/route.ts`, `src/app/api/sources/[id]/zip/route.ts`, `src/app/api/s/[token]/download/route.ts`, `src/features/activity/lib/operation-labels.ts`, `messages/{5}.json`.
- `operations.ts` : ajouter à l'union `OperationAction` : `"download" | "download-zip" | "share-download"`.
- `download/route.ts` : après `requireSourceAccess` réussi, `await recordOperation({ action: "download", sourceId: source.id, sourceName: source.name, target: key })` avant de servir/rediriger.
- `zip/route.ts` : après contrôle d'accès, `recordOperation({ action: "download-zip", ... , target: <résumé lisible: préfixe ou nombre d'entrées>, detail? })`.
- `s/[token]/download/route.ts` : contexte public (pas de session). `recordOperation({ action: "share-download", sourceId, sourceName, target: key, detail: "share-link" })` — `recordOperation` enregistre `actor=null` puisque `getSession()` est null. Résoudre `sourceId`/`sourceName` depuis la share.
- `operation-labels.ts` : mapper les 3 actions vers `labelKey` + icône (non destructif ; ex. `Download`, `FileArchive`, `Share2`/`Link`).
- i18n : `activity.operations.download`, `.downloadZip`, `.shareDownload` (5 locales). Attention à la convention de nommage des `labelKey` (camelCase, cf. `moveTo`/`shareCreate`).

### Task 5 — Export CSV/JSON
Fichiers : `src/lib/dal/operations.ts`, nouveau `src/app/api/activity/export/route.ts`, `src/app/(app)/activity/page.tsx`, `messages/{5}.json`.
- `operations.ts` : `exportOperations(filters: OperationFilters): Promise<OperationRecord[]>` — même `where` que `listOperations`, `orderBy createdAt desc`, `take: 50_000` (cap sécurité).
- `export/route.ts` : `GET`, `requireAdmin()` (sinon `apiError`/404 aligné). Lit `format` (`csv`|`json`, défaut `csv`) + filtres `action`/`source`/`q`. 
  - CSV : `text/csv`, `Content-Disposition: attachment; filename="audit-<YYYY-MM-DD>.csv"`, colonnes `created_at`(ISO),`action`,`source_name`,`target`,`detail`,`actor` ; échappement CSV correct.
  - JSON : `application/json`, tableau `OperationRecord` (dates ISO).
  - Si `length === 50_000` (cap atteint) : `console.warn` + en-tête `X-Audit-Truncated: true`.
- `activity/page.tsx` : deux liens (`buttonVariants` `outline`/`sm`) « Exporter CSV » / « Exporter JSON » dans l'en-tête (`PageHeader` children), portant les filtres courants en query string. Cachés si 0 entrée.
- i18n : `activity.exportCsv`, `activity.exportJson` (5 locales).

### Task 6 — Rétention (purge paresseuse + UI)
Fichiers : `src/lib/dal/settings.ts`, `src/lib/dal/operations.ts`, `src/app/(app)/activity/page.tsx`, `src/features/admin/components/settings-form.tsx`, `src/app/(app)/admin/settings/page.tsx`, `src/features/admin/actions.ts`, `messages/{5}.json`.
- `settings.ts` : `getAuditRetentionDays(): Promise<number>` (0 si absent/invalide), `setAuditRetentionDays(days)`. Clés `auditRetentionDays`, `auditLastPurgeAt` (epoch ms).
- `operations.ts` : `purgeExpiredOperations(): Promise<void>` — days≤0→return ; lit `auditLastPurgeAt`, si <24h→return ; `cutoff = now - days*86400000` ; `deleteMany({ where:{ createdAt:{ lt: cutoff }}})` ; écrit `auditLastPurgeAt=now`. try/catch (ne throw jamais).
- `activity/page.tsx` : `await purgeExpiredOperations()` en tête, avant `listOperations` (admin-only déjà garanti).
- `actions.ts` : `setAuditRetention(days: number): Promise<ActionResult>` via `withAdmin`, zod `z.union([z.literal(0),z.literal(30),z.literal(90),z.literal(180),z.literal(365)])`, DAL set.
- `settings-form.tsx` : ligne « rétention audit » avec `Select` de presets (0=Indéfiniment,30,90,180,365). Prop `auditRetentionDays`.
- `settings/page.tsx` : charger `getAuditRetentionDays()` et le passer.
- i18n : `admin.settingsForm.auditRetentionTitle/Description`, `.auditRetentionForever/30/90/180/365`, `.auditRetentionToast` (5 locales).

---

## Fin
Après Task 6 : `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, puis revue finale whole-branch (diff working tree). Pas de commit, pas de merge — restitution à l'utilisateur pour test manuel UI.
