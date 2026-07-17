import "server-only";
import { getConfigOverrides } from "@/lib/dal/settings";
import { env } from "@/lib/env";
import {
  fieldProvenance,
  OIDC_FIELDS,
  type OidcConfig,
  type OidcField,
  type Provenance,
  resolveOidcConfig,
  resolveSmtpConfig,
  SMTP_FIELDS,
  type SmtpConfig,
  type SmtpField,
} from "./resolve";

export type { OidcConfig, OidcField, Provenance, SmtpConfig, SmtpField };
export { OIDC_FIELDS, SMTP_FIELDS };

function smtpEnvDefaults() {
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
  };
}

function oidcEnvDefaults() {
  return {
    discoveryUrl: env.OIDC_DISCOVERY_URL,
    clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET,
    providerLabel: env.OIDC_PROVIDER_LABEL,
    scopes: env.OIDC_SCOPES,
    groupsClaim: env.OIDC_GROUPS_CLAIM,
  };
}

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  return resolveSmtpConfig(await getConfigOverrides("smtp"), smtpEnvDefaults());
}

export async function getOidcConfig(): Promise<OidcConfig | null> {
  return resolveOidcConfig(await getConfigOverrides("oidc"), oidcEnvDefaults());
}

export async function isSmtpConfigured(): Promise<boolean> {
  return (await getSmtpConfig()) !== null;
}

export async function isOidcConfigured(): Promise<boolean> {
  return (await getOidcConfig()) !== null;
}

/** Par champ : la valeur effective vient-elle de la DB, de l'env, ou de nulle part ? */
export async function getSmtpProvenance(): Promise<
  Record<SmtpField, Provenance>
> {
  const db = await getConfigOverrides("smtp");
  const defaults = smtpEnvDefaults();
  return Object.fromEntries(
    SMTP_FIELDS.map((field) => [
      field,
      fieldProvenance(
        db[field],
        defaults[field] === undefined ? undefined : String(defaults[field]),
      ),
    ]),
  ) as Record<SmtpField, Provenance>;
}

export async function getOidcProvenance(): Promise<
  Record<OidcField, Provenance>
> {
  const db = await getConfigOverrides("oidc");
  const defaults = oidcEnvDefaults();
  return Object.fromEntries(
    OIDC_FIELDS.map((field) => [
      field,
      fieldProvenance(db[field], defaults[field]),
    ]),
  ) as Record<OidcField, Provenance>;
}
