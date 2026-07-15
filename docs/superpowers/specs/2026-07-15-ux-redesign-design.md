# Refonte UX — moins de dialogs, patterns Google Drive / Cloudreve

Date : 2026-07-15 · Branche : `ux/redesign`
Méthode : audit parallèle par deux agents Opus (browser + vues secondaires), review et synthèse Fable.

## Problème

L'app fonctionne bien mais l'UX repose massivement sur des dialogs modales :
10 overlays sont montés simultanément dans `file-browser.tsx`, et plusieurs
sont mal calibrées (détails d'un fichier dans une modale centrée bloquante,
formulaire source de 6 champs + 16 providers tassé dans une `max-w-md`,
modale entière pour renommer un champ). Inspirations : Google Drive,
Cloudreve.

## Principe directeur

Réserver les Dialogs aux confirmations et micro-actions. Tout le reste est
redistribué :

| Contenu | Pattern cible |
|---|---|
| Détails / métadonnées | Panneau latéral droit non bloquant (`Sheet`) |
| Preview | Overlay plein écran immersif |
| Actions par item | Menu contextuel (clic droit) + kebab ⋮ |
| Rename | Édition inline (double-clic / F2) |
| Recherche source | Command palette (cmdk) |
| Share, New folder | Popover ancré |
| Formulaires complexes (source, groupe) | Page dédiée |
| Confirmations destructives | Dialog (inchangé) |

## Priorités

### Phase 1 — cœur du browser (impact maximal)

**P1 · Panneau de détails latéral** (sévérité haute, effort M)
`details-dialog.tsx` → `details-panel.tsx` basé sur `Sheet side="right"`
(présent, inutilisé). Non bloquant, suit l'élément sélectionné, reste ouvert
pendant la navigation. Déclencheurs existants conservés (bouton Info, clic
fichier non prévisualisable).

**P2 · Menus d'actions unifiés** (haute, M/L)
Aujourd'hui : jusqu'à 6 icônes révélées au hover par ligne
(`browser-columns.tsx:188-285`) et 5 boutons flottants par carte
(`file-grid.tsx:356-418`), aucun clic droit. Cible : un composant
`ItemActionsMenu` unique (Preview, Download, Share, Rename, Move, Copy,
Duplicate, ZIP, Details, Delete) servi par un kebab `DropdownMenu` et un
`ContextMenu` Radix (à ajouter dans `ui/`). Les lignes/cartes ne gardent
que 1-2 actions rapides + kebab.

**P3 · Preview immersive** (moyenne, M)
`preview-dialog.tsx` : Dialog bordé avec header/footer (~120px perdus) →
overlay `fixed inset-0` opaque, topbar translucide superposée (nom, actions
Share/Download/Details, fermer), nav ←/→, Esc. L'état URL `?preview=` est
conservé.

### Phase 2 — friction du browser

**P4 · Rename inline** (moyenne, M) — champ in-place sur le nom
(double-clic/F2), suppression de `rename-dialog.tsx`. New folder en popover.

**P5 · Move to… + folder-picker partagé** (moyenne, M/L)
Move n'existe qu'en drag-and-drop (`file-browser.tsx:357`) avec un
AlertDialog de confirmation ; Copy to a son propre navigateur de dossiers.
Factoriser le folder-picker de `copy-to-dialog.tsx`, l'utiliser pour Move
et Copy, exposer Move dans les menus et le `selection-toolbar` (qui gagne
aussi Share et un kebab overflow). DnD conservé comme raccourci.

**P6 · Recherche en command palette** (moyenne, M)
`search-dialog.tsx` réimplémente cmdk à la main alors que `command.tsx` et
une palette Ctrl+K existent. Cible : `CommandDialog` unifié, résultats
ouvrant directement le fichier (preview/détails) et non plus seulement le
dossier. Clarifier filtre local vs recherche source.

**P7 · Share en popover** (basse, S) — 2 champs (expiry, password) puis vue
copie du lien, ancré au bouton Share.

### Phase 3 — vues secondaires / admin

**P8 · Sources en pages dédiées** (haute côté admin, M)
`/admin/sources/new` et `/admin/sources/[id]/edit` réutilisant `SourceForm`
tel quel (6 champs, 16 providers, test de connexion — à l'étroit en
`max-w-md`). Pattern Cloudreve.

**P9 · Filtres URL généralisés** (moyenne, M)
Le pattern propre d'Activity (recherche debounced + filtres en URL) est
appliqué aux tables Users, Groups, Shares. Tri sur les colonnes clés.

**P10 · Divers** (basse, S chacun)
Header sticky factorisé (`AppHeader`), empty state Shares migré vers
`EmptyState`, confirmation sur revoke grant, label sur Migrate + progression,
create group inline, affordance ⌘K visible.

## Hors périmètre

Dashboard admin (P4 du rapport secondaire), refonte sidebar, panneaux
redimensionnables (`react-resizable-panels`) — notés comme follow-ups.

## Architecture / contraintes

- Aucune nouvelle dépendance sauf `@radix-ui/react-context-menu`.
- Les conventions ARCHITECTURE.md restent inchangées (server actions,
  RSC-first, pas de cross-feature imports) : la refonte est purement
  présentation/interaction, les actions serveur existantes sont réutilisées.
- Vérification : `pnpm typecheck && pnpm lint && pnpm test && pnpm build` ;
  tests UI manuels par l'utilisateur.

## Ordre d'implémentation

P1 → P2 → P3 (commit par item), puis P4-P7, puis P8-P10. Chaque item est un
commit isolé et réversible.
