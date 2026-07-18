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
