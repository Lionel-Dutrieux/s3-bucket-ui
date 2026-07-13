// Runs once when the server boots (not at build time) — fail fast on
// misconfiguration instead of erroring on the first request.
export async function register() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      "ENCRYPTION_KEY is missing or malformed: expected 64 hex characters. " +
        "Generate one with: openssl rand -hex 32",
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing: point it at your PostgreSQL database, " +
        "e.g. postgresql://user:password@localhost:5432/bucket_ui",
    );
  }
}
