# next-intl — internationalisation de l'UI (en, fr)

Date : 2026-07-17 · Branche : chore/finition-audit (ou branche dédiée)

## Objectif

Remplacer toutes les strings UI hardcodées par des traductions next-intl,
anglais (référence) et français, sans changer l'arborescence des routes.

## Décisions validées

- **Mode « without i18n routing »** : pas de préfixe `/fr` dans l'URL, pas de
  middleware, pas de segment `[locale]`. La locale vient d'un cookie ;
  à défaut, négociation sur l'en-tête `Accept-Language` ; défaut `en`.
- **Sélecteur** : sous-menu « Language » dans le menu utilisateur
  (`features/auth/components/user-menu.tsx`), qui pose le cookie via une
  server action puis `router.refresh()`.
- **Périmètre** : UI complète (pages, composants, dialogs, toasts, labels
  d'activité, erreurs affichées, pages publiques sign-in/share viewer,
  `generateMetadata`). **Hors périmètre** : messages de validation zod,
  emails (nodemailer), logs serveur.

## Architecture

- `next.config.ts` enveloppé par `createNextIntlPlugin()` (`next-intl/plugin`).
- `src/i18n/config.ts` — pur, sans I/O : `locales = ["en", "fr"] as const`,
  type `Locale`, `defaultLocale`, nom du cookie (`locale`). Importable par
  n'importe quelle couche.
- `src/i18n/request.ts` — `getRequestConfig` (next-intl/server) : lit le
  cookie, sinon parse `Accept-Language`, sinon `en` ; charge
  `messages/<locale>.json`.
- Layout racine : `NextIntlClientProvider` (hérite locale + messages), et
  `<html lang={locale}>` via `getLocale()`.
- `global.d.ts` : augmentation `AppConfig` de next-intl avec le shape de
  `messages/en.json` → clés typées, vérifiées par `tsc`.

## Messages

- `messages/en.json` et `messages/fr.json` à la racine du repo.
- Un namespace par zone, miroir de l'architecture : `common`, `layout`,
  `auth`, `account`, `browser`, `sources`, `admin`, `activity`, `shares`.
- ICU pour pluriels/interpolations (`{count, plural, …}`).
- L'anglais est la source de vérité ; le français est complet dès le départ.

## Usage

- Client components : `useTranslations("<ns>")`.
- RSC, `generateMetadata`, server actions, route handlers :
  `getTranslations` (les messages d'erreur d'`ActionResult` sont traduits
  côté serveur avant retour).
- Modules purs (`features/*/lib/`, ex. `operation-labels.ts`,
  `providers.ts`) : ils exposent des **clés** de message (ou des ids), la
  résolution en texte se fait au point de rendu — pas d'I/O dans `lib/`.
- Server action `setLocale` dans `features/auth/actions.ts` : zod sur la
  liste des locales, pose le cookie, retourne `ActionResult`.

## Gestion d'erreur

- Locale inconnue dans le cookie → retombe sur la négociation/`en`.
- Clé manquante → comportement next-intl par défaut (erreur en dev,
  fallback clé en prod) ; le typage sur `en.json` empêche les clés
  inexistantes à la compilation.

## Tests / vérification

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Unit test éventuel : négociation Accept-Language si extraite en helper pur.
- UI vérifiée manuellement par l'utilisateur (pas d'E2E).
