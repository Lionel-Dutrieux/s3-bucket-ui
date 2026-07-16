# Icônes providers, logo app & white labelling — Design

Date : 2026-07-16
Statut : validé

## Objectif

1. Afficher le logo de marque du provider (au lieu de l'icône lucide générique)
   pour chaque source dans la sidebar.
2. Utiliser le logo officiel de l'app (celui du README) dans la sidebar, la
   page de login et la page de partage public.
3. White labelling optionnel configurable par l'admin : nom de l'application,
   logo d'entreprise, couleur primaire.

## Portée

Le branding white-label s'applique **partout** : sidebar, page de login, page
de partage public `/s/[token]`, et titre d'onglet (metadata). Quand le
white labelling est actif, « Bucket UI » n'apparaît plus nulle part dans l'UI.

## 1. Icônes provider dans la sidebar

- `src/components/layout/app-sidebar.tsx` : remplacer l'icône lucide générique
  de chaque item de source (`<group.icon>`) par le composant existant
  `ProviderPlate` / `ProviderLogo` de
  `src/features/sources/components/provider-logos.tsx` (déjà utilisé par le
  provider picker admin).
- Les en-têtes de groupe par provider restent inchangés.
- Fallback existant conservé (`HardDrive`) pour un provider inconnu.

## 2. Logo de l'app par défaut

- Copier `docs/assets/logo.svg` vers `public/logo.svg` ; mettre à jour le
  README pour pointer vers ce chemin unique (pas de duplication).
- La sidebar remplace l'icône `Cylinder` par ce logo ; idem page de login et
  page de partage `/s/[token]`.

## 3. White labelling — données

Trois nouvelles clés dans le modèle `Setting` existant (key/value, DAL
`src/lib/dal/settings.ts`) :

| Clé                     | Type    | Défaut        | Notes                                    |
| ----------------------- | ------- | ------------- | ---------------------------------------- |
| `branding.appName`      | texte   | « Bucket UI » | 1–64 caractères                          |
| `branding.logo`         | data-URL| (absent)      | SVG/PNG/WebP, max 512 Ko, validé serveur |
| `branding.primaryColor` | hex     | (absent)      | ex. `#FBBF24` ; invalide → ignorée       |

Helper RSC `getBranding()` (mémoïsé via `React.cache`) →
`{ appName, hasCustomLogo, primaryColor }`. Jamais la data-URL complète dans
le HTML.

## 4. White labelling — application

### Root layout
- `generateMetadata` : titre = `appName`.
- Si `primaryColor` défini : injection d'un `<style>` inline avec conversion
  hex → oklch et dérivation automatique des variantes light/dark pour
  `--primary`, `--primary-foreground` (noir/blanc selon contraste),
  `--sidebar-primary`, `--sidebar-primary-foreground`, `--ring`.

### Logo custom
- Route `GET /api/branding/logo` (publique) qui sert le contenu de
  `branding.logo` décodé, avec `Cache-Control` long + invalidation par query
  param de version (ex. hash ou timestamp du setting).
- Les SVG sont servis avec `Content-Security-Policy: sandbox` pour neutraliser
  tout script embarqué.
- Sidebar / login / page de partage : logo custom si défini, sinon
  `public/logo.svg` + `appName` en texte.

### Admin
- Nouvelle section « Branding » dans la page Settings existante
  (`src/app/(app)/admin/settings/page.tsx`, composant dans
  `src/features/admin/components/`).
- Champs : nom de l'app, upload logo (input file lu en data-URL côté client,
  envoyé via server action), color picker, bouton « réinitialiser » (remet les
  défauts, supprime les clés).
- Server actions dans `src/features/admin/actions.ts` : validation zod
  (taille, types MIME autorisés, format hex), garde `currentAdmin()`, retour
  `ActionResult`. Formulaire via le kit TanStack Form (`useAppForm`).

## 5. Gestion d'erreurs

- Logo trop gros / type non autorisé → erreur de validation `ActionResult`.
- Couleur invalide en DB → ignorée, thème par défaut.
- `getBranding()` tolérant : toute clé absente ou illisible → valeur par
  défaut.

## 6. Tests

- Conversion hex → oklch et dérivation light/dark (unitaires).
- Validation zod des actions branding (nom, logo, couleur).
- Fallbacks de `getBranding()`.
- Vérification : `pnpm typecheck && pnpm lint && pnpm test && pnpm build` ;
  test UI manuel par l'utilisateur.

## Hors périmètre

- Multi-tenant (un seul branding global).
- Favicon custom, emails, thèmes complets (au-delà de la couleur primaire).
- Stockage du logo sur disque ou bucket externe.
