import "server-only";
import { revalidatePath } from "next/cache";
import { type ActionResult, actionError } from "@/lib/action-result";
import { currentAdmin, type SessionUser } from "@/lib/auth/session";

const NOT_AUTHORIZED = "You are not allowed to administrate this app.";

interface AdminGuard {
  /** Verb phrase used for the log tag ("[admin] … failed") and the default
   *  error ("Could not ….") — e.g. "delete this group". */
  action: string;
  /** Extra log context (ids, emails) kept out of the user-facing message. */
  context?: string;
  /** Overrides the error returned on an unexpected failure. */
  failureMessage?: string;
  /** Settings that don't affect the rendered shell can skip the layout
   *  revalidation. Defaults to true. */
  revalidate?: boolean;
}

/**
 * Shared preamble for every admin action: the admin role re-checked
 * server-side (the /admin layout guard protects pages only, never these POST
 * endpoints), then the mutation with uniform error logging, then the layout
 * revalidation on success. The callback receives the admin (for self-checks
 * like "you cannot ban yourself") and owns input parsing and the mutation.
 */
export async function withAdmin(
  guard: AdminGuard,
  run: (admin: SessionUser) => Promise<ActionResult>,
): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return actionError(NOT_AUTHORIZED);

  let result: ActionResult;
  try {
    result = await run(admin);
  } catch (error) {
    const context = guard.context ? ` (${guard.context})` : "";
    console.error(`[admin] ${guard.action} failed${context}:`, error);
    return actionError(guard.failureMessage ?? `Could not ${guard.action}.`);
  }
  if (result.ok && guard.revalidate !== false) revalidatePath("/", "layout");
  return result;
}
