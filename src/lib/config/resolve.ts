/**
 * Fusion pure des overrides DB (strings de la table Setting) avec les
 * défauts issus de l'environnement. Précédence : DB > env, champ par champ.
 * Aucune I/O ici — index.ts branche ce module sur Prisma et lib/env.
 */

export const SMTP_FIELDS = [
  "host",
  "port",
  "secure",
  "user",
  "password",
  "from",
] as const;
export type SmtpField = (typeof SMTP_FIELDS)[number];

export const OIDC_FIELDS = [
  "discoveryUrl",
  "clientId",
  "clientSecret",
  "providerLabel",
  "scopes",
  "groupsClaim",
] as const;
export type OidcField = (typeof OIDC_FIELDS)[number];

export type Provenance = "db" | "env" | "unset";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  password: string | null;
  from: string;
}

export interface SmtpEnvDefaults {
  host: string | undefined;
  port: number;
  secure: boolean;
  user: string | undefined;
  password: string | undefined;
  from: string | undefined;
}

export interface OidcConfig {
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  providerLabel: string;
  scopes: string;
  groupsClaim: string;
}

export interface OidcEnvDefaults {
  discoveryUrl: string | undefined;
  clientId: string | undefined;
  clientSecret: string | undefined;
  providerLabel: string;
  scopes: string;
  groupsClaim: string;
}

function pick(db: string | undefined, env: string | undefined): string | null {
  return db !== undefined && db !== "" ? db : (env ?? null);
}

export function fieldProvenance(
  dbValue: string | undefined,
  envValue: string | undefined,
): Provenance {
  if (dbValue !== undefined && dbValue !== "") return "db";
  if (envValue !== undefined && envValue !== "") return "env";
  return "unset";
}

/** null quand ni la DB ni l'env ne fournissent host + from (règle smtpEnabled). */
export function resolveSmtpConfig(
  db: Partial<Record<SmtpField, string>>,
  envDefaults: SmtpEnvDefaults,
): SmtpConfig | null {
  const host = pick(db.host, envDefaults.host);
  const from = pick(db.from, envDefaults.from);
  if (!host || !from) return null;
  return {
    host,
    from,
    port: db.port !== undefined ? Number(db.port) : envDefaults.port,
    secure: db.secure !== undefined ? db.secure === "true" : envDefaults.secure,
    user: pick(db.user, envDefaults.user),
    password: pick(db.password, envDefaults.password),
  };
}

/** null quand le trio discoveryUrl/clientId/clientSecret résolu est incomplet. */
export function resolveOidcConfig(
  db: Partial<Record<OidcField, string>>,
  envDefaults: OidcEnvDefaults,
): OidcConfig | null {
  const discoveryUrl = pick(db.discoveryUrl, envDefaults.discoveryUrl);
  const clientId = pick(db.clientId, envDefaults.clientId);
  const clientSecret = pick(db.clientSecret, envDefaults.clientSecret);
  if (!discoveryUrl || !clientId || !clientSecret) return null;
  return {
    discoveryUrl,
    clientId,
    clientSecret,
    providerLabel: pick(db.providerLabel, envDefaults.providerLabel) ?? "SSO",
    scopes:
      pick(db.scopes, envDefaults.scopes) ?? "openid profile email groups",
    groupsClaim: pick(db.groupsClaim, envDefaults.groupsClaim) ?? "groups",
  };
}
