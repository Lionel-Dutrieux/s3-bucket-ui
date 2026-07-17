# Providers S3 supplémentaires + « Déplacer vers » cross-source

Date : 2026-07-17
Statut : design validé, prêt pour plan d'implémentation

## Contexte

Deux demandes indépendantes mais complémentaires :

1. **Élargir la liste des providers** dans « Ajouter une source ». Le registre
   compte aujourd'hui 16 entrées (`src/lib/storage/providers.ts`), dont un
   catch-all `s3-compatible`. `files-sdk@2.1.0` expose une bien plus large
   famille S3-compatible ; on veut ajouter tous les presets nommés qui ne
   dégradent pas la solution actuelle (presigned URL, streaming, listing par
   dossier, copy serveur).
2. **Rétablir « Déplacer vers une autre source »**. Aujourd'hui `Copier vers…`
   est cross-source (non-destructif) mais `Déplacer vers…` est intra-source
   uniquement. On veut un vrai déplacement cross-source : copie inter-source
   (moteur existant) **plus** suppression de l'origine, non-destructif sur
   échec partiel.

Contraintes projet (AGENTS.md / ARCHITECTURE.md) : pas d'import cross-feature,
zod côté serveur, permissions re-vérifiées serveur, toute string UI via
next-intl (clés dans les 5 fichiers de langue), vérif
`pnpm typecheck && pnpm lint && pnpm test && pnpm build`, l'utilisateur teste
l'UI manuellement.

## Décisions

- **Providers** : ajouter toute la famille S3 compatible manquante. Écarter
  les SaaS dégradés (Dropbox/Drive/OneDrive/Box/Vercel Blob/etc.) qui cassent
  listing/presign/aperçu.
- **Move** : vrai déplacement cross-source (copy + delete origine). Pas
  d'unification des dialogs Copier/Déplacer — deux entrées distinctes.
- **Surfaces move** : inchangées (selection-toolbar en multi-sélection + menu
  kebab d'un élément). On ajoute seulement le sélecteur de source destination.
- **i18n** : nouvelles clés traduites dans les 5 langues (en, fr, de, es, zh).

---

## Section A — Providers S3 supplémentaires

### Principe (KISS)

Tous les nouveaux providers parlent l'API S3 → ils mappent sur
`adapter: "s3"`. **Aucune modification de `client.ts`, `buildAdapter`, du
schéma zod, ni du formulaire.** L'ajout est purement déclaratif dans quatre
fichiers, dont deux cosmétiques à fallback automatique.

### Fichiers touchés

1. **`src/lib/storage/providers.ts`** — une entrée `ProviderDefinition` par
   provider (`id`, `label`, `adapter:"s3"`, `region`, `forcePathStyle`,
   `endpointPlaceholder`, `fieldLabels: S3_FIELD_LABELS`).
2. **`src/features/sources/components/provider-catalog.ts`** — un `hint`
   (+ `keywords` si utile) par provider, chaînes littérales comme l'existant.
3. **`src/features/sources/components/provider-icons.ts`** — un glyph lucide
   par provider (fallback `HardDrive` automatique si omis).
4. **`src/features/sources/components/provider-logos.tsx`** — une marque
   `simple-icons` **si elle existe dans le paquet installé**, sinon rien (le
   fallback plate neutre est déjà géré). Vérifier l'existence de chaque
   `si<Brand>` avant de l'ajouter ; ne pas inventer d'import.

### Providers ajoutés

Tous : `adapter:"s3"`, `fieldLabels: S3_FIELD_LABELS`. Les valeurs
region/path-style/endpoint ci-dessous sont la cible ; à confirmer contre la doc
de chaque provider pendant l'implémentation.

| id | label | region | forcePathStyle | endpointPlaceholder |
|---|---|---|---|---|
| `akamai` | Akamai / Linode Object Storage | from-endpoint | false | `https://<region>.linodeobjects.com` |
| `idrive-e2` | IDrive e2 | us-east-1 | true | `https://<region>.idrivee2-XX.com` |
| `vultr` | Vultr Object Storage | from-endpoint | false | `https://<region>.vultrobjects.com` |
| `filebase` | Filebase | us-east-1 | true | `https://s3.filebase.com` |
| `exoscale` | Exoscale SOS | from-endpoint | false | `https://sos-<zone>.exo.io` |
| `oracle-cloud` | Oracle Cloud Object Storage | from-endpoint | true | `https://<ns>.compat.objectstorage.<region>.oraclecloud.com` |
| `ibm-cos` | IBM Cloud Object Storage | from-endpoint | true | `https://s3.<region>.cloud-object-storage.appdomain.cloud` |
| `tigris` | Tigris | auto | true | `https://fly.storage.tigris.dev` |
| `tencent-cos` | Tencent Cloud COS | from-endpoint | false | `https://cos.<region>.myqcloud.com` |
| `alibaba-oss` | Alibaba Cloud OSS | from-endpoint | false | `https://oss-<region>.aliyuncs.com` |
| `yandex` | Yandex Object Storage | ru-central1 | true | `https://storage.yandexcloud.net` |

### Caveats (non bloquants)

- **Tencent COS** : nommage de bucket `nom-appid` ; l'utilisateur colle le
  bucket complet. Virtual-hosted (`forcePathStyle:false`).
- **Alibaba OSS** : exige le virtual-hosted (`forcePathStyle:false`).
- **`region: "from-endpoint"`** suppose que `regionFromEndpoint()`
  (`src/lib/storage/region.ts`) sait extraire la région du hostname ciblé.
  Pour chaque provider en from-endpoint, vérifier que l'extraction fonctionne
  sur l'endpoint réel ; sinon basculer sur une région fixe plausible (le
  gateway ignore souvent la région dans la signature).
- **`neon`** (présent dans le SDK, S3-backed) est **écarté** : cas d'usage
  ambigu, aucun intérêt clair pour un viewer de buckets.

### Écartés volontairement

Dropbox, Google Drive, OneDrive, SharePoint, Box, Vercel Blob, Appwrite,
Convex, UploadThing, PocketBase, Cloudinary… — cassent le listing par dossier
(`delimiter`), les liens de partage (`url()` throw ou permanent) et l'aperçu
par range. Hors périmètre.

### Non-objectifs

- Pas d'adapters `files-sdk` dédiés `wasabi()`/`backblazeB2()` : l'approche
  générique `s3()` + endpoint reste en place (uniformité, aucun changement de
  champs de formulaire).
- Pas de refonte du picker ni du formulaire.

---

## Section B — « Déplacer vers » cross-source

### UI

`src/features/browser/components/move-to-dialog.tsx` gagne, avant le
`FolderPicker`, le même sélecteur de source destination que
`copy-to-dialog.tsx` :

- `Select` peuplé par `useQuery(browserQueries.writableSources())`, ouvert
  seulement quand le dialog est ouvert.
- État `destSourceId` ; reset à l'ouverture ; reset de `destPrefix` au
  changement de source.
- `FolderPicker` pointé sur `destSourceId` (au lieu de `sourceId`).
- Le `DestinationDialog` partagé reste inchangé.
- `destinationLabel` façon copy-to : `→ <name>:/<prefix>`.
- Les deux surfaces existantes (selection-toolbar + menu kebab
  `entry-actions.tsx`) héritent automatiquement du comportement cross-source
  puisqu'elles utilisent `MoveToDialog`. Aucune nouvelle surface.

Le garde-fou `planMove` (self/descendant) ne s'applique **que** quand
destination === source. En cross-source, pas de self-move possible ; on
n'appelle `planMove` que dans le cas intra-source.

### Moteur serveur

Nouvelle action `moveEntriesToSource(sourceId, destId, targets, destPrefix)`
dans `src/features/browser/actions.ts`, retournant
`ActionResult<CrossMoveSummary>`.

Validation (mêmes garde-fous que `copyEntriesToSource`) : `destPrefix` vide ou
terminé par `/`, `targets` non vide et sous `MOVE_ENTRIES_MAX`, folders
terminés par `/`.

Permissions (plus strict que copy-to car l'origine est détruite) :

- `requireSourceAccess(sourceId)` → doit exister **et** `access.canEdit`.
- `requireSourceAccess(destId)` → doit exister **et** `access.canEdit`.
- Messages 404-style uniformes, comme l'existant.

Branches :

- **`destId === sourceId`** → déléguer à la logique `moveEntries` existante
  (move natif intra-source : pré-check conflits all-or-nothing, `files.move`
  natif, `movePrefix` pour les dossiers). Zéro régression. En pratique :
  factoriser le corps de `moveEntries` pour le réutiliser, ou appeler
  `moveEntries` en interne.
- **`destId !== sourceId`** → nouveau `moveEntriesAcross` (voir ci-dessous).

Log d'activité : action `"move-to"`, `detail: → <dest.name>:/<destPrefix>`,
même forme que `copy-to`.

### `moveEntriesAcross` (mutations.ts)

Ajouter dans `src/features/browser/server/mutations.ts` :

```
moveEntriesAcross(from: Files, to: Files, targets, destPrefix)
  : Promise<{ error } | { summary: CrossMoveSummary }>
```

Implémentation :

1. Appeler `copyEntriesAcross(from, to, targets, destPrefix)` (moteur
   existant, inchangé). Si `error`, propager.
2. **Supprimer de l'origine uniquement les objets effectivement copiés.**
   `copyEntriesAcross` renvoie aujourd'hui des compteurs agrégés
   (`{copied, skipped, failed}`) mais pas la liste des clés copiées.
   → Étendre `copyEntriesAcross` (ou ajouter une variante interne partagée)
   pour renvoyer aussi la liste des `srcKey` copiés avec succès, sans changer
   le comportement observable de `copyEntriesToSource`.
   Alternative si on ne veut pas toucher la signature publique : extraire un
   `copyEntriesAcrossDetailed` interne renvoyant les clés, et faire de
   `copyEntriesAcross` un mince wrapper qui n'expose que le résumé.
3. Supprimer ces `srcKey` sur `from` par batches (réutiliser la logique bulk
   de suppression ; ne pas utiliser `deletePrefix` qui vide un préfixe entier
   — ici on supprime une liste précise de clés copiées).
4. Retourner `CrossMoveSummary { moved, skipped, failed }` où `moved` = objets
   copiés **et** supprimés de l'origine. En cas d'échec de suppression après
   copie, compter l'objet comme `moved` côté destination mais logguer
   l'échec de nettoyage (l'objet reste alors des deux côtés — acceptable et
   non-destructif ; on ne perd jamais de données).

**Invariant de sécurité :** on ne supprime jamais un objet qui n'a pas été
confirmé copié en destination. `skipped` (déjà présent en destination) et
`failed` (copie échouée) ne sont **pas** supprimés de l'origine.

### Limites / bornes

Réutiliser `CROSS_COPY_MAX_OBJECTS` / `CROSS_COPY_CONCURRENCY` pour la partie
copie ; la suppression suit la concurrence de suppression existante.

### i18n

- `browser.moveToDialog.*` : ajouter les clés du sélecteur de source
  (`chooseSource`, `thisSource`, `loadingSources`, `noWritableSources`,
  `destinationSourceAria`) et les toasts (`movedToast`, `movePartialFailedToast`
  avec `{moved, skipped, failed}`), en s'alignant sur `browser.copyToDialog`.
- `operation-labels.ts` + clés associées : label de l'action `"move-to"`.
- Hints des nouveaux providers dans `provider-catalog.ts` (littéraux, non
  i18n — cohérent avec l'existant).
- Toutes les nouvelles clés de messages ajoutées dans **en, fr, de, es, zh**.

### Non-objectifs

- Pas de move cross-source « transactionnel » (rollback global) : le modèle
  reste best-effort par objet, non-destructif.
- Pas d'unification des dialogs Copier/Déplacer.

---

## Plan de vérification

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Tests unitaires : logique pure du move cross-source (sélection des clés à
  supprimer = uniquement les copiées) si une fonction pure est extractible ;
  `planMove` inchangé.
- L'utilisateur teste l'UI manuellement : ajout d'un nouveau provider S3,
  déplacement cross-source (dont le cas destination === source qui doit rester
  le move natif), échec partiel (origine préservée pour les non-copiés).

## Séquence de build suggérée

1. Section A : registre + catalog + icons + logos (livrable indépendant,
   testable seul).
2. Section B moteur : `moveEntriesAcross` + extension interne de
   `copyEntriesAcross` pour exposer les clés copiées + action
   `moveEntriesToSource`.
3. Section B UI : sélecteur de source dans `MoveToDialog`.
4. i18n (5 langues) + operation label.
5. Vérification complète.
