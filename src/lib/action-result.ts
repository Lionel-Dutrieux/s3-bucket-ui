/**
 * Uniform return shape for every server action. A discriminated union keeps
 * call sites honest: narrowing on `ok` gives either `data` or `error`, never
 * an ambiguous mix. Actions must return messages safe to show in the UI —
 * raw errors belong in server logs.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function actionOk(): ActionResult<undefined>;
export function actionOk<T>(data: T): ActionResult<T>;
export function actionOk<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function actionError<T = undefined>(error: string): ActionResult<T> {
  return { ok: false, error };
}
