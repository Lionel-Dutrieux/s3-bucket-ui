import "server-only";
import { getConfigOverrides } from "@/lib/dal/settings";
import { env } from "@/lib/env";
import {
  fieldProvenance,
  type Provenance,
  resolveSmtpConfig,
  SMTP_FIELDS,
  type SmtpConfig,
  type SmtpField,
} from "./resolve";

export type { Provenance, SmtpConfig, SmtpField };
export { SMTP_FIELDS };

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

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  return resolveSmtpConfig(await getConfigOverrides("smtp"), smtpEnvDefaults());
}

export async function isSmtpConfigured(): Promise<boolean> {
  return (await getSmtpConfig()) !== null;
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
