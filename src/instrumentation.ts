// Runs once when the server boots (not at build time). Importing lib/env
// validates DATABASE_URL and ENCRYPTION_KEY, so a missing or malformed variable
// fails fast here instead of erroring on the first request.
import { assertSmtpEnv } from "@/lib/env";

export async function register() {
  // Environment validation runs when lib/env is imported above.
  assertSmtpEnv();
}
