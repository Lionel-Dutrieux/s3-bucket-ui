# Providers S3 supplémentaires + « Déplacer vers » cross-source — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 11 presets de stockage S3-compatibles à « Ajouter une source » et rendre « Déplacer vers » capable de cibler une autre source (copie inter-source + suppression de l'origine, non-destructif sur échec partiel).

**Architecture:** Les nouveaux providers sont purement déclaratifs (`adapter:"s3"`), aucun changement du backend d'adaptation ; une extension pure de `regionFromEndpoint` couvre les hostnames qui encodent la région autrement. Le move cross-source réutilise le moteur `copyEntriesAcross` existant, étendu pour renvoyer les clés effectivement copiées, puis supprime uniquement celles-là sur l'origine.

**Tech Stack:** Next.js (RSC + server actions), TypeScript, TanStack Query, next-intl, files-sdk, Vitest, Biome.

## Global Constraints

- Pas d'import cross-feature ; pas de barrel files (Biome `noRestrictedImports`).
- Mutations = server actions retournant `ActionResult` (`src/lib/action-result.ts`), permissions re-vérifiées serveur (`requireSourceAccess`, `access.canEdit`).
- Toute string UI passe par next-intl ; toute clé ajoutée existe dans les **5** fichiers : `messages/{en,fr,de,es,zh}.json`.
- Les hints de providers dans `provider-catalog.ts` restent des chaînes **littérales** (pattern existant, non-i18n).
- Prisma uniquement dans `src/lib/dal/`.
- Vérification : `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. L'utilisateur teste l'UI manuellement — ne pas lancer d'E2E.
- Icônes : réutiliser les glyphs lucide déjà importés ; n'ajouter une marque `simple-icons` que si `si<Nom>` existe réellement dans le paquet installé (confirmé présents : `siAkamai`, `siVultr`, `siExoscale`, `siAlibabacloud`, `siYandexcloud`).

---

### Task 1: Étendre `regionFromEndpoint` pour les nouveaux hostnames

**Files:**
- Modify: `src/lib/storage/region.ts`
- Test: `src/lib/storage/region.test.ts` (create)

**Interfaces:**
- Consumes: rien.
- Produces: `regionFromEndpoint(endpoint: string): string` — signature inchangée, motifs supplémentaires reconnus (Tencent, Alibaba, Exoscale, Oracle). Consommé par `buildAdapter` dans `src/lib/storage/client.ts` quand `region === "from-endpoint"`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/storage/region.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { regionFromEndpoint } from "./region";

describe("regionFromEndpoint", () => {
  it("keeps existing AWS / DigitalOcean behavior", () => {
    expect(regionFromEndpoint("https://s3.eu-west-3.amazonaws.com")).toBe(
      "eu-west-3",
    );
    expect(regionFromEndpoint("https://s3.amazonaws.com")).toBe("us-east-1");
    expect(regionFromEndpoint("https://nyc3.digitaloceanspaces.com")).toBe(
      "nyc3",
    );
  });
  it("extracts Tencent COS region", () => {
    expect(regionFromEndpoint("https://cos.ap-guangzhou.myqcloud.com")).toBe(
      "ap-guangzhou",
    );
  });
  it("extracts Alibaba OSS region", () => {
    expect(regionFromEndpoint("https://oss-cn-hangzhou.aliyuncs.com")).toBe(
      "cn-hangzhou",
    );
  });
  it("extracts Exoscale zone", () => {
    expect(regionFromEndpoint("https://sos-ch-gva-2.exo.io")).toBe("ch-gva-2");
  });
  it("extracts Oracle Cloud region", () => {
    expect(
      regionFromEndpoint(
        "https://ns123.compat.objectstorage.us-ashburn-1.oraclecloud.com",
      ),
    ).toBe("us-ashburn-1");
  });
});
```

- [ ] **Step 2: Lancer le test — doit échouer**

Run: `pnpm vitest run src/lib/storage/region.test.ts`
Expected: FAIL (Tencent/Alibaba/Exoscale/Oracle renvoient un mauvais label).

- [ ] **Step 3: Implémenter**

Remplacer le corps de `src/lib/storage/region.ts` par :

```ts
// AWS and DigitalOcean encode the signing region in the endpoint hostname:
// s3.<region>.amazonaws.com, <region>.digitaloceanspaces.com. A few providers
// encode it differently and get an explicit pattern below.
export function regionFromEndpoint(endpoint: string): string {
  const labels = new URL(endpoint).hostname.split(".");

  // Oracle: <namespace>.compat.objectstorage.<region>.oraclecloud.com
  const oci = labels.indexOf("objectstorage");
  if (oci !== -1 && labels[oci + 1]) return labels[oci + 1];

  // Tencent COS: cos.<region>.myqcloud.com
  if (labels[0] === "cos" && labels.length > 3) return labels[1];

  // Alibaba OSS: oss-<region>.aliyuncs.com
  if (labels[0].startsWith("oss-")) return labels[0].slice("oss-".length);

  // Exoscale SOS: sos-<zone>.exo.io
  if (labels[0].startsWith("sos-")) return labels[0].slice("sos-".length);

  if (labels[0] === "s3") {
    // s3.eu-west-3.amazonaws.com → eu-west-3 ; s3.amazonaws.com → us-east-1
    return labels.length > 3 ? labels[1] : "us-east-1";
  }
  return labels[0]; // nyc3.digitaloceanspaces.com → nyc3
}
```

- [ ] **Step 4: Lancer le test — doit passer**

Run: `pnpm vitest run src/lib/storage/region.test.ts`
Expected: PASS (tous les cas).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/region.ts src/lib/storage/region.test.ts
git commit -m "feat(storage): parse signing region for Tencent/Alibaba/Exoscale/Oracle endpoints"
```

---

### Task 2: Ajouter les 11 presets S3-compatibles

**Files:**
- Modify: `src/lib/storage/providers.ts` (insérer avant l'entrée `s3-compatible`)
- Modify: `src/features/sources/components/provider-catalog.ts` (objet `CATALOG`)
- Modify: `src/features/sources/components/provider-icons.ts` (objet `PROVIDER_ICONS`)
- Modify: `src/features/sources/components/provider-logos.tsx` (imports + `BRAND_MARKS`)
- Test: `src/lib/storage/providers.test.ts` (create)

**Interfaces:**
- Consumes: `regionFromEndpoint` (Task 1) via l'usage runtime des providers en `from-endpoint`.
- Produces: 11 nouveaux `ProviderDefinition` avec les ids : `akamai`, `idrive-e2`, `vultr`, `filebase`, `exoscale`, `oracle-cloud`, `ibm-cos`, `tigris`, `tencent-cos`, `alibaba-oss`, `yandex`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/storage/providers.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { getProvider, normalizeEndpoint, PROVIDERS } from "./providers";

const NEW_IDS = [
  "akamai",
  "idrive-e2",
  "vultr",
  "filebase",
  "exoscale",
  "oracle-cloud",
  "ibm-cos",
  "tigris",
  "tencent-cos",
  "alibaba-oss",
  "yandex",
];

describe("new S3-compatible providers", () => {
  it("registers every new id as an s3 adapter", () => {
    for (const id of NEW_IDS) {
      const def = getProvider(id);
      expect(def, id).toBeDefined();
      expect(def?.adapter, id).toBe("s3");
    }
  });
  it("keeps the catch-all last in the registry order", () => {
    const s3compat = PROVIDERS.findIndex((p) => p.id === "s3-compatible");
    const yandex = PROVIDERS.findIndex((p) => p.id === "yandex");
    expect(yandex).toBeGreaterThanOrEqual(0);
    expect(yandex).toBeLessThan(s3compat);
  });
  it("accepts a well-formed https endpoint for each new provider", () => {
    expect(normalizeEndpoint("yandex", "https://storage.yandexcloud.net")).toEqual({
      ok: true,
      value: "https://storage.yandexcloud.net",
    });
    expect(
      normalizeEndpoint("tencent-cos", "https://cos.ap-guangzhou.myqcloud.com"),
    ).toEqual({ ok: true, value: "https://cos.ap-guangzhou.myqcloud.com" });
  });
});
```

- [ ] **Step 2: Lancer le test — doit échouer**

Run: `pnpm vitest run src/lib/storage/providers.test.ts`
Expected: FAIL (`getProvider(id)` renvoie `undefined`).

- [ ] **Step 3: Ajouter les entrées du registre**

Dans `src/lib/storage/providers.ts`, insérer ces 11 objets **juste avant** l'entrée `{ id: "s3-compatible", … }` :

```ts
  {
    id: "akamai",
    label: "Akamai / Linode Object Storage",
    adapter: "s3",
    region: "from-endpoint", // us-east-1.linodeobjects.com → us-east-1
    forcePathStyle: false,
    endpointPlaceholder: "https://<region>.linodeobjects.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "idrive-e2",
    label: "IDrive e2",
    adapter: "s3",
    region: "us-east-1", // gateway ignores it; keep a valid SigV4 default
    endpointPlaceholder: "https://<region>.idrivee2-XX.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "vultr",
    label: "Vultr Object Storage",
    adapter: "s3",
    region: "from-endpoint", // ewr1.vultrobjects.com → ewr1
    forcePathStyle: false,
    endpointPlaceholder: "https://<region>.vultrobjects.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "filebase",
    label: "Filebase",
    adapter: "s3",
    region: "us-east-1",
    endpointPlaceholder: "https://s3.filebase.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "exoscale",
    label: "Exoscale SOS",
    adapter: "s3",
    region: "from-endpoint", // sos-ch-gva-2.exo.io → ch-gva-2
    forcePathStyle: false,
    endpointPlaceholder: "https://sos-<zone>.exo.io",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "oracle-cloud",
    label: "Oracle Cloud Object Storage",
    adapter: "s3",
    region: "from-endpoint", // …objectstorage.<region>.oraclecloud.com
    endpointPlaceholder:
      "https://<namespace>.compat.objectstorage.<region>.oraclecloud.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "ibm-cos",
    label: "IBM Cloud Object Storage",
    adapter: "s3",
    region: "from-endpoint", // s3.<region>.cloud-object-storage… → <region>
    endpointPlaceholder:
      "https://s3.<region>.cloud-object-storage.appdomain.cloud",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "tigris",
    label: "Tigris",
    adapter: "s3",
    region: "auto",
    endpointPlaceholder: "https://fly.storage.tigris.dev",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "tencent-cos",
    label: "Tencent Cloud COS",
    adapter: "s3",
    region: "from-endpoint", // cos.<region>.myqcloud.com → <region>
    forcePathStyle: false,
    endpointPlaceholder: "https://cos.<region>.myqcloud.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "alibaba-oss",
    label: "Alibaba Cloud OSS",
    adapter: "s3",
    region: "from-endpoint", // oss-<region>.aliyuncs.com → <region>
    forcePathStyle: false,
    endpointPlaceholder: "https://oss-<region>.aliyuncs.com",
    fieldLabels: S3_FIELD_LABELS,
  },
  {
    id: "yandex",
    label: "Yandex Object Storage",
    adapter: "s3",
    region: "ru-central1",
    endpointPlaceholder: "https://storage.yandexcloud.net",
    fieldLabels: S3_FIELD_LABELS,
  },
```

- [ ] **Step 4: Ajouter les hints du picker**

Dans `src/features/sources/components/provider-catalog.ts`, ajouter ces entrées à l'objet `CATALOG` (avant `sftp`) :

```ts
  akamai: {
    hint: "Linode object storage",
    keywords: "linode akamai connected cloud",
  },
  "idrive-e2": { hint: "IDrive e2 storage", keywords: "idrive" },
  vultr: { hint: "Vultr object storage" },
  filebase: { hint: "IPFS-backed, S3 API", keywords: "ipfs" },
  exoscale: { hint: "Exoscale SOS", keywords: "sos" },
  "oracle-cloud": { hint: "OCI object storage", keywords: "oracle oci" },
  "ibm-cos": { hint: "IBM Cloud object storage", keywords: "ibm cos" },
  tigris: { hint: "Globally distributed S3", keywords: "fly" },
  "tencent-cos": { hint: "Tencent Cloud COS", keywords: "tencent qcloud" },
  "alibaba-oss": { hint: "Alibaba Cloud OSS", keywords: "alibaba aliyun oss" },
  yandex: { hint: "Yandex object storage" },
```

- [ ] **Step 5: Ajouter les icônes de repli (lucide, sans nouvel import)**

Dans `src/features/sources/components/provider-icons.ts`, ajouter à `PROVIDER_ICONS` (avant `sftp`), en réutilisant uniquement les icônes déjà importées en tête de fichier :

```ts
  akamai: Globe,
  "idrive-e2": HardDrive,
  vultr: Server,
  filebase: Database,
  exoscale: Cloud,
  "oracle-cloud": Database,
  "ibm-cos": Server,
  tigris: Globe,
  "tencent-cos": Cloud,
  "alibaba-oss": Cloudy,
  yandex: Globe,
```

- [ ] **Step 6: Ajouter les marques de marque disponibles**

Dans `src/features/sources/components/provider-logos.tsx`, étendre l'import `simple-icons` et l'objet `BRAND_MARKS`. Modifier l'import existant pour ajouter (ordre alphabétique) `siAkamai`, `siAlibabacloud`, `siExoscale`, `siVultr`, `siYandexcloud` :

```tsx
import {
  siAkamai,
  siAlibabacloud,
  siBackblaze,
  siCloudflare,
  siDigitalocean,
  siExoscale,
  siGooglecloudstorage,
  siHetzner,
  siMinio,
  siNextcloud,
  siOvh,
  siScaleway,
  siVultr,
  siWasabi,
  siYandexcloud,
} from "simple-icons";
```

Puis ajouter à `BRAND_MARKS` (avant `webdav`) :

```tsx
  akamai: siAkamai,
  vultr: siVultr,
  exoscale: siExoscale,
  "alibaba-oss": siAlibabacloud,
  yandex: siYandexcloud,
```

(Oracle, IBM, Tencent, Tigris, Filebase, IDrive n'ont pas de marque dans le paquet installé — ils tombent sur le glyph lucide + plate neutre, déjà géré par `ProviderLogo`/`ProviderPlate`.)

- [ ] **Step 7: Lancer le test — doit passer**

Run: `pnpm vitest run src/lib/storage/providers.test.ts`
Expected: PASS.

- [ ] **Step 8: Vérifier typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: aucun échec (imports `simple-icons` résolus, pas d'icône lucide manquante).

- [ ] **Step 9: Commit**

```bash
git add src/lib/storage/providers.ts src/lib/storage/providers.test.ts \
  src/features/sources/components/provider-catalog.ts \
  src/features/sources/components/provider-icons.ts \
  src/features/sources/components/provider-logos.tsx
git commit -m "feat(sources): add 11 S3-compatible provider presets"
```

---

### Task 3: `copyEntriesAcross` renvoie les clés copiées + `moveEntriesAcross`

**Files:**
- Modify: `src/features/browser/server/mutations.ts`

**Interfaces:**
- Consumes: `copyEntriesAcross(from, to, targets, destPrefix)` existant, `DELETE_FOLDER_BATCH` (déjà importé), `EntryTarget` (déjà importé).
- Produces:
  - `CrossCopyResult = { error: string } | { summary: CrossCopySummary; copiedSrcKeys: string[] }` (ajout du champ `copiedSrcKeys`).
  - `interface CrossMoveSummary { moved: number; skipped: number; failed: number }`
  - `type CrossMoveResult = { error: string } | { summary: CrossMoveSummary }`
  - `moveEntriesAcross(from: Files, to: Files, targets: EntryTarget[], destPrefix: string): Promise<CrossMoveResult>`

- [ ] **Step 1: Étendre `copyEntriesAcross` pour collecter les clés copiées**

Dans `src/features/browser/server/mutations.ts` :

1. Remplacer la déclaration de type :

```ts
export type CrossCopyResult =
  | { error: string }
  | { summary: CrossCopySummary; copiedSrcKeys: string[] };
```

2. Dans le corps de `copyEntriesAcross`, juste après `const summary: CrossCopySummary = { copied: 0, skipped: 0, failed: 0 };`, ajouter :

```ts
  const copiedSrcKeys: string[] = [];
```

3. Dans le `try` de la boucle, après `summary.copied++;`, ajouter `copiedSrcKeys.push(pair.srcKey);` :

```ts
          const stored = await from.download(pair.srcKey);
          await to.upload(pair.destKey, stored.stream(), {
            contentType: stored.type || undefined,
          });
          summary.copied++;
          copiedSrcKeys.push(pair.srcKey);
```

4. Remplacer le `return { summary };` final par :

```ts
  return { summary, copiedSrcKeys };
```

(`copyEntriesToSource` déstructure `result.summary` et ignore `copiedSrcKeys` — inchangé.)

- [ ] **Step 2: Ajouter `moveEntriesAcross` en fin de fichier**

Toujours dans `src/features/browser/server/mutations.ts`, ajouter :

```ts
export interface CrossMoveSummary {
  moved: number;
  skipped: number;
  failed: number;
}

export type CrossMoveResult = { error: string } | { summary: CrossMoveSummary };

/**
 * Cross-source move: copies a selection into another source (reusing the
 * cross-copy engine), then deletes from the origin ONLY the objects confirmed
 * copied. Objects that were skipped (already present at the destination) or
 * failed to copy are left untouched, so a partial run never loses data. A
 * failure to clean up the origin after a successful copy is logged but still
 * counts as "moved" (the object then exists on both sides — safe, not lost).
 */
export async function moveEntriesAcross(
  from: Files,
  to: Files,
  targets: EntryTarget[],
  destPrefix: string,
): Promise<CrossMoveResult> {
  const copy = await copyEntriesAcross(from, to, targets, destPrefix);
  if ("error" in copy) return { error: copy.error };

  let cleanupFailures = 0;
  for (let i = 0; i < copy.copiedSrcKeys.length; i += DELETE_FOLDER_BATCH) {
    const batch = copy.copiedSrcKeys.slice(i, i + DELETE_FOLDER_BATCH);
    try {
      const result = await from.delete(batch);
      if (result.errors?.length) cleanupFailures += result.errors.length;
    } catch (error) {
      cleanupFailures += batch.length;
      console.error("[browser] cross-move cleanup failed:", error);
    }
  }
  if (cleanupFailures > 0) {
    console.error(
      `[browser] cross-move left ${cleanupFailures} origin object(s) after copy`,
    );
  }

  return {
    summary: {
      moved: copy.summary.copied,
      skipped: copy.summary.skipped,
      failed: copy.summary.failed,
    },
  };
}
```

- [ ] **Step 3: Vérifier typecheck**

Run: `pnpm typecheck`
Expected: PASS (aucun autre appelant de `copyEntriesAcross` ne casse — `copyEntriesToSource` n'utilise que `.summary`).

- [ ] **Step 4: Commit**

```bash
git add src/features/browser/server/mutations.ts
git commit -m "feat(browser): add moveEntriesAcross cross-source move engine"
```

---

### Task 4: Action `moveEntriesToSource` + type d'opération `move-to`

**Files:**
- Modify: `src/features/browser/actions.ts`
- Modify: `src/lib/dal/operations.ts` (union `OperationAction`)
- Modify: `src/features/activity/lib/operation-labels.ts` (clé + entrée `LABELS`)
- Modify: `messages/en.json`, `messages/fr.json`, `messages/de.json`, `messages/es.json`, `messages/zh.json` (clé `activity.operations.moveTo`)

**Interfaces:**
- Consumes: `moveEntriesAcross`, `CrossMoveSummary` (Task 3) ; `requireSourceAccess`, `getFilesClient`, `recordOperation`, `MOVE_ENTRIES_MAX`, helpers `actionOk`/`actionError` (déjà importés dans `actions.ts`).
- Produces: `moveEntriesToSource(sourceId: string, destSourceId: string, targets: EntryTarget[], destPrefix: string): Promise<ActionResult<CrossMoveSummary>>`.

- [ ] **Step 1: Ajouter `"move-to"` à l'union d'actions**

Dans `src/lib/dal/operations.ts`, ajouter `"move-to"` à `OperationAction` (après `"move"`) :

```ts
  | "move"
  | "move-to"
  | "copy"
```

- [ ] **Step 2: Ajouter la présentation de l'action**

Dans `src/features/activity/lib/operation-labels.ts` :

1. Ajouter `"moveTo"` à `OperationLabelKey` (après `"move"`) :

```ts
  | "move"
  | "moveTo"
  | "copy"
```

2. Ajouter l'entrée dans `LABELS` (après `move`) :

```ts
  move: { labelKey: "move", icon: FolderInput },
  "move-to": { labelKey: "moveTo", icon: FolderInput },
```

- [ ] **Step 3: Ajouter la clé i18n `activity.operations.moveTo` (5 langues)**

Dans chaque fichier, ajouter la clé après `"move"` dans le namespace `activity.operations` :

- `messages/en.json` → `"moveTo": "Moved to",`
- `messages/fr.json` → `"moveTo": "Déplacé",`
- `messages/de.json` → `"moveTo": "Verschoben nach",`
- `messages/es.json` → `"moveTo": "Movido a",`
- `messages/zh.json` → `"moveTo": "已移动至",`

- [ ] **Step 4: Ajouter l'action serveur**

Dans `src/features/browser/actions.ts`, ajouter `moveEntriesAcross` et `CrossMoveSummary` à l'import depuis `@/features/browser/server/mutations` (à côté de `copyEntriesAcross`, `CrossCopySummary`, `movePrefix`), puis ajouter l'action juste après `moveEntries` :

```ts
/**
 * Moves a selection into a folder of ANOTHER source: copies each object across
 * (streaming through this process) then removes it from the origin. Editing
 * the origin AND the destination is required — a move destroys the origin, so
 * it needs more than the read grant a copy-to does. Non-destructive on partial
 * failure: only objects confirmed copied are removed from the origin.
 */
export async function moveEntriesToSource(
  sourceId: string,
  destSourceId: string,
  targets: EntryTarget[],
  destPrefix: string,
): Promise<ActionResult<CrossMoveSummary>> {
  const t = await getTranslations("browser.errors");
  if (destPrefix !== "" && !destPrefix.endsWith("/")) {
    return actionError(t("invalidDestination"));
  }
  if (targets.length === 0) return actionError(t("nothingSelected"));
  if (targets.length > MOVE_ENTRIES_MAX) {
    return actionError(t("moveAtMost", { max: MOVE_ENTRIES_MAX }));
  }
  if (
    targets.some(
      (target) => target.kind === "folder" && !target.prefix.endsWith("/"),
    )
  ) {
    return actionError(t("invalidFolder"));
  }

  const origin = await requireSourceAccess(sourceId);
  if (!origin) return actionError(t("sourceNotFound"));
  if (!origin.access.canEdit) return actionError(t("editDenied"));
  const dest = await requireSourceAccess(destSourceId);
  if (!dest) return actionError(t("destinationNotFound"));
  if (!dest.access.canEdit) return actionError(t("addDeniedOther"));

  try {
    const result = await moveEntriesAcross(
      getFilesClient(origin.source),
      getFilesClient(dest.source),
      targets,
      destPrefix,
    );
    if ("error" in result) return actionError(result.error);

    const single = targets.length === 1 ? targets[0] : null;
    await recordOperation({
      action: "move-to",
      sourceId: origin.source.id,
      sourceName: origin.source.name,
      target: single
        ? single.kind === "file"
          ? single.key
          : single.prefix
        : `${targets.length} items`,
      detail: `→ ${dest.source.name}:/${destPrefix}`,
    });
    return actionOk(result.summary);
  } catch (error) {
    console.error(
      `[browser] cross-move failed (source=${sourceId} → ${destSourceId}):`,
      error,
    );
    return actionError(t("moveFailure"));
  }
}
```

(Toutes les clés `browser.errors` utilisées ici — `invalidDestination`, `nothingSelected`, `moveAtMost`, `invalidFolder`, `sourceNotFound`, `editDenied`, `destinationNotFound`, `addDeniedOther`, `moveFailure` — existent déjà, réutilisées par `moveEntries`/`copyEntriesToSource`.)

- [ ] **Step 5: Vérifier typecheck + lint + tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS (les tests existants incluant `operation-labels`/activity ne cassent pas ; la nouvelle clé est présente dans les 5 langues).

- [ ] **Step 6: Commit**

```bash
git add src/features/browser/actions.ts src/lib/dal/operations.ts \
  src/features/activity/lib/operation-labels.ts \
  messages/en.json messages/fr.json messages/de.json messages/es.json messages/zh.json
git commit -m "feat(browser): add moveEntriesToSource server action + move-to audit action"
```

---

### Task 5: `MoveToDialog` avec sélecteur de source destination

**Files:**
- Modify: `src/features/browser/components/move-to-dialog.tsx` (réécriture)
- Modify: `messages/en.json`, `messages/fr.json`, `messages/de.json`, `messages/es.json`, `messages/zh.json` (namespace `browser.moveToDialog`)

**Interfaces:**
- Consumes: `moveEntries` (existant, intra-source), `moveEntriesToSource` (Task 4), `browserQueries.writableSources()` (existant), `DestinationDialog`, `FolderPicker`, `planMove`, `usePendingAction`, composants `Select`.
- Produces: `MoveToDialog` — mêmes props (`sourceId`, `targets`, `onOpenChange`, `onMoved`), donc aucun changement dans `selection-toolbar.tsx`, `entry-actions.tsx`, `use-browser-dialogs.ts`.

- [ ] **Step 1: Ajouter les clés i18n `browser.moveToDialog` (5 langues)**

Dans chaque fichier, remplacer le bloc `"moveToDialog"` par la version enrichie (title/description/moveHere/moving/movedToast conservés, nouvelles clés ajoutées).

`messages/en.json` :

```json
    "moveToDialog": {
      "title": "Move {count, plural, one {# item} other {# items}} to…",
      "description": "Moving copies each object to the destination and deletes the original. Folders move everything inside them.",
      "destinationSourceAria": "Destination source",
      "loadingSources": "Loading sources…",
      "chooseSource": "Choose a source…",
      "thisSource": "this source",
      "noWritableSources": "You don't have edit access on any source.",
      "moveHere": "Move here",
      "moving": "Moving…",
      "movedToast": "{count, plural, one {Moved # item} other {Moved # items}}",
      "movedAcrossToast": "{moved, plural, one {# object moved} other {# objects moved}}{skipped, select, 0 {} other {, {skipped} skipped}} to {name}",
      "movePartialFailedToast": "{moved, plural, one {# object moved} other {# objects moved}}{skipped, select, 0 {} other {, {skipped} skipped}}, {failed} failed — run it again to retry."
    },
```

`messages/fr.json` :

```json
    "moveToDialog": {
      "title": "Déplacer {count, plural, one {# élément} other {# éléments}} vers…",
      "description": "Le déplacement copie chaque objet vers la destination puis supprime l'original. Les dossiers emportent tout leur contenu.",
      "destinationSourceAria": "Source de destination",
      "loadingSources": "Chargement des sources…",
      "chooseSource": "Choisir une source…",
      "thisSource": "cette source",
      "noWritableSources": "Vous n'avez accès en écriture à aucune source.",
      "moveHere": "Déplacer ici",
      "moving": "Déplacement…",
      "movedToast": "{count, plural, one {# élément déplacé} other {# éléments déplacés}}",
      "movedAcrossToast": "{moved, plural, one {# objet déplacé} other {# objets déplacés}}{skipped, select, 0 {} other {, {skipped} ignoré(s)}} vers {name}",
      "movePartialFailedToast": "{moved, plural, one {# objet déplacé} other {# objets déplacés}}{skipped, select, 0 {} other {, {skipped} ignoré(s)}}, {failed} en échec — relancez pour réessayer."
    },
```

`messages/de.json` :

```json
    "moveToDialog": {
      "title": "{count, plural, one {# Element} other {# Elemente}} verschieben nach…",
      "description": "Beim Verschieben wird jedes Objekt an das Ziel kopiert und das Original gelöscht. Ordner nehmen ihren gesamten Inhalt mit.",
      "destinationSourceAria": "Zielquelle",
      "loadingSources": "Quellen werden geladen…",
      "chooseSource": "Quelle auswählen…",
      "thisSource": "diese Quelle",
      "noWritableSources": "Sie haben auf keine Quelle Schreibzugriff.",
      "moveHere": "Hierher verschieben",
      "moving": "Wird verschoben…",
      "movedToast": "{count, plural, one {# Element verschoben} other {# Elemente verschoben}}",
      "movedAcrossToast": "{moved, plural, one {# Objekt verschoben} other {# Objekte verschoben}}{skipped, select, 0 {} other {, {skipped} übersprungen}} nach {name}",
      "movePartialFailedToast": "{moved, plural, one {# Objekt verschoben} other {# Objekte verschoben}}{skipped, select, 0 {} other {, {skipped} übersprungen}}, {failed} fehlgeschlagen — erneut ausführen, um es zu wiederholen."
    },
```

`messages/es.json` :

```json
    "moveToDialog": {
      "title": "Mover {count, plural, one {# elemento} other {# elementos}} a…",
      "description": "Mover copia cada objeto al destino y elimina el original. Las carpetas se llevan todo su contenido.",
      "destinationSourceAria": "Origen de destino",
      "loadingSources": "Cargando orígenes…",
      "chooseSource": "Elige un origen…",
      "thisSource": "este origen",
      "noWritableSources": "No tienes acceso de edición en ningún origen.",
      "moveHere": "Mover aquí",
      "moving": "Moviendo…",
      "movedToast": "{count, plural, one {# elemento movido} other {# elementos movidos}}",
      "movedAcrossToast": "{moved, plural, one {# objeto movido} other {# objetos movidos}}{skipped, select, 0 {} other {, {skipped} omitido(s)}} a {name}",
      "movePartialFailedToast": "{moved, plural, one {# objeto movido} other {# objetos movidos}}{skipped, select, 0 {} other {, {skipped} omitido(s)}}, {failed} con error — ejecútalo de nuevo para reintentar."
    },
```

`messages/zh.json` :

```json
    "moveToDialog": {
      "title": "将 {count} 个项目移动到…",
      "description": "移动会将每个对象复制到目标位置并删除原件。文件夹会带上其中的所有内容。",
      "destinationSourceAria": "目标数据源",
      "loadingSources": "正在加载数据源…",
      "chooseSource": "选择数据源…",
      "thisSource": "当前数据源",
      "noWritableSources": "你对任何数据源都没有写入权限。",
      "moveHere": "移动到此处",
      "moving": "正在移动…",
      "movedToast": "已移动 {count} 个项目",
      "movedAcrossToast": "已移动 {moved} 个对象{skipped, select, 0 {} other {，跳过 {skipped} 个}} 到 {name}",
      "movePartialFailedToast": "已移动 {moved} 个对象{skipped, select, 0 {} other {，跳过 {skipped} 个}}，{failed} 个失败 — 请重新运行以重试。"
    },
```

- [ ] **Step 2: Réécrire `MoveToDialog`**

Remplacer intégralement `src/features/browser/components/move-to-dialog.tsx` par :

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moveEntries, moveEntriesToSource } from "@/features/browser/actions";
import { browserQueries } from "@/features/browser/api/queries";
import { DestinationDialog } from "@/features/browser/components/destination-dialog";
import { FolderPicker } from "@/features/browser/components/folder-picker";
import { usePendingAction } from "@/features/browser/hooks/use-pending-action";
import { type EntryTarget, planMove } from "@/features/browser/lib/move";

/**
 * "Move to…" with a destination picker. Defaults to the current source (a
 * plain within-source move, native copy+delete with the all-or-nothing
 * conflict check); pick another source to move across — copy through this
 * process, then delete the copied objects from the origin.
 */
export function MoveToDialog({
  sourceId,
  targets,
  onOpenChange,
  onMoved,
}: {
  sourceId: string;
  /** Selection to move — the dialog is open while non-null. */
  targets: EntryTarget[] | null;
  onOpenChange: (open: boolean) => void;
  onMoved: () => void;
}) {
  const t = useTranslations("browser.moveToDialog");
  const tFolder = useTranslations("browser.folderPicker");
  const tErrors = useTranslations("browser.errors");
  const open = targets !== null;
  const [destSourceId, setDestSourceId] = useState("");
  const [destPrefix, setDestPrefix] = useState("");
  const { pending, track } = usePendingAction();

  // Fresh start each time the dialog opens — default to the current source.
  useEffect(() => {
    if (open) {
      setDestSourceId(sourceId);
      setDestPrefix("");
    }
  }, [open, sourceId]);

  const sources = useQuery({
    ...browserQueries.writableSources(),
    enabled: open,
  });
  const dest = sources.data?.find((source) => source.id === destSourceId);
  const isSameSource = destSourceId === sourceId;
  const count = targets?.length ?? 0;

  // Self/descendant guard only makes sense within the same source.
  const plan = targets && isSameSource ? planMove(targets, destPrefix) : null;
  const intraMoveCount = plan && !plan.error ? plan.moves.length : 0;

  const submitDisabled =
    !destSourceId ||
    (isSameSource ? !!plan?.error || intraMoveCount === 0 : false);

  const run = async () => {
    if (!targets || !destSourceId) return;

    if (isSameSource) {
      if (!plan || plan.error || intraMoveCount === 0) return;
      const result = await track(() =>
        moveEntries(sourceId, targets, destPrefix),
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("movedToast", { count: intraMoveCount }));
      onMoved();
      return;
    }

    const result = await track(() =>
      moveEntriesToSource(sourceId, destSourceId, targets, destPrefix),
    );
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { moved, skipped, failed } = result.data;
    if (failed > 0) {
      toast.warning(t("movePartialFailedToast", { moved, skipped, failed }));
    } else {
      toast.success(
        t("movedAcrossToast", { moved, skipped, name: dest?.name ?? "" }),
      );
    }
    onMoved();
  };

  return (
    <DestinationDialog
      open={open}
      onOpenChange={onOpenChange}
      pending={pending}
      title={t("title", { count })}
      description={t("description")}
      destinationLabel={dest ? `→ ${dest.name}:/${destPrefix}` : ""}
      submitLabel={t("moveHere")}
      pendingLabel={t("moving")}
      submitDisabled={submitDisabled}
      onSubmit={run}
    >
      <Select
        value={destSourceId}
        onValueChange={(value) => {
          setDestSourceId(value);
          setDestPrefix("");
        }}
        disabled={pending || sources.isPending}
      >
        <SelectTrigger className="w-full" aria-label={t("destinationSourceAria")}>
          <SelectValue
            placeholder={
              sources.isPending ? t("loadingSources") : t("chooseSource")
            }
          />
        </SelectTrigger>
        <SelectContent>
          {sources.data?.map((source) => (
            <SelectItem key={source.id} value={source.id}>
              {source.name}
              {source.id === sourceId ? (
                <span className="text-xs text-muted-foreground">
                  {t("thisSource")}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {source.bucket}
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {sources.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("noWritableSources")}
        </p>
      ) : null}

      {destSourceId ? (
        <FolderPicker
          sourceId={destSourceId}
          rootLabel={dest?.name ?? tFolder("root")}
          prefix={destPrefix}
          onPrefixChange={setDestPrefix}
          disabled={pending}
        />
      ) : null}

      {plan?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors("selfMove")}
        </p>
      ) : null}
    </DestinationDialog>
  );
}
```

- [ ] **Step 3: Vérifier la chaîne complète**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: PASS partout.

- [ ] **Step 4: Commit**

```bash
git add src/features/browser/components/move-to-dialog.tsx \
  messages/en.json messages/fr.json messages/de.json messages/es.json messages/zh.json
git commit -m "feat(browser): cross-source destination in Move to… dialog"
```

---

## Vérification finale

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — vert.
- [ ] Test manuel utilisateur (hors périmètre agent) :
  - Ajouter une source avec un des nouveaux providers (ex. Yandex, Tencent) → connexion OK.
  - « Déplacer vers » en gardant la source courante → move natif intra-source inchangé.
  - « Déplacer vers » une autre source → objets copiés puis retirés de l'origine ; toast correct.
  - Échec partiel (un objet déjà présent en destination) → l'objet skippé reste à l'origine, les autres sont déplacés.
  - Historique d'activité : entrée « Déplacé » (move-to) présente.

## Notes de couverture des tests

- TDD unitaire : `regionFromEndpoint` (Task 1) et le registre providers (Task 2).
- Tasks 3–5 (moteur serveur, action, UI) : vérifiées par `typecheck`/`lint`/`build` + test manuel, conformément à la convention du projet (l'utilisateur teste l'UI ; `mutations.ts`/`actions.ts` importent `next-intl/server`, non stubbé sous Vitest, donc pas de test unitaire serveur ici — cohérent avec l'absence de tests serveur unitaires existants).
