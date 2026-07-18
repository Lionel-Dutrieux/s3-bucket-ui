// Declarative IdP presets for the SSO provider form — mirrors the S3 provider
// registry pattern (src/lib/storage/providers.ts): pure data, no UI, no I/O.
// A preset pre-fills the "add provider" form (issuer shape, scopes, groups
// claim) and surfaces a setup hint. Strings that reach the UI are exposed as
// next-intl **keys** (this is a pure lib module — it never resolves text).

export type SsoPresetId = "pocket-id" | "keycloak" | "entra" | "generic";

/** Every message key these presets expose, relative to the `admin.sso` namespace. */
export type SsoPresetMessageKey =
  | "presets.pocketId.label"
  | "presets.pocketId.issuerPlaceholder"
  | "presets.pocketId.help"
  | "presets.keycloak.label"
  | "presets.keycloak.issuerPlaceholder"
  | "presets.keycloak.help"
  | "presets.entra.label"
  | "presets.entra.issuerPlaceholder"
  | "presets.entra.help"
  | "presets.generic.label"
  | "presets.generic.issuerPlaceholder";

export interface SsoPreset {
  id: SsoPresetId;
  /** i18n key, relative to the `admin.sso` namespace, for the display name. */
  labelKey: SsoPresetMessageKey;
  /** i18n key (under `admin.sso`) for the issuer field placeholder. */
  issuerPlaceholderKey: SsoPresetMessageKey;
  /** Prefilled default scopes (space-separated). */
  scopes: string;
  /** Prefilled default groups-claim name. */
  groupsClaim: string;
  /** i18n key (under `admin.sso`) for a setup hint, or null when none. */
  helpNoteKey: SsoPresetMessageKey | null;
}

const DEFAULT_SCOPES = "openid profile email";
const GROUPS_SCOPES = "openid profile email groups";

export const SSO_PRESETS: readonly SsoPreset[] = [
  {
    id: "pocket-id",
    labelKey: "presets.pocketId.label",
    issuerPlaceholderKey: "presets.pocketId.issuerPlaceholder",
    scopes: GROUPS_SCOPES,
    groupsClaim: "groups",
    helpNoteKey: "presets.pocketId.help",
  },
  {
    id: "keycloak",
    labelKey: "presets.keycloak.label",
    issuerPlaceholderKey: "presets.keycloak.issuerPlaceholder",
    scopes: GROUPS_SCOPES,
    groupsClaim: "groups",
    helpNoteKey: "presets.keycloak.help",
  },
  {
    id: "entra",
    labelKey: "presets.entra.label",
    issuerPlaceholderKey: "presets.entra.issuerPlaceholder",
    // Entra exposes group membership as GUIDs in the id_token; the userinfo
    // endpoint omits it — provisionUser falls back to decoding the id_token.
    scopes: DEFAULT_SCOPES,
    groupsClaim: "groups",
    helpNoteKey: "presets.entra.help",
  },
  {
    id: "generic",
    labelKey: "presets.generic.label",
    issuerPlaceholderKey: "presets.generic.issuerPlaceholder",
    scopes: DEFAULT_SCOPES,
    groupsClaim: "groups",
    helpNoteKey: null,
  },
] as const;

export function ssoPresetById(id: string): SsoPreset | undefined {
  return SSO_PRESETS.find((preset) => preset.id === id);
}
