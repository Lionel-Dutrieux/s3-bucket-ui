import { NextResponse } from "next/server";

/**
 * Single error shape for every route handler: `{ error: string }` JSON with
 * the proper status. Fetchers (`features/x/api/client.ts`) rely on this to
 * surface messages — plain-text bodies would silently break them.
 */
export function apiError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}
